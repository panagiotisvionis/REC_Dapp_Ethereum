"""Protocol-locked site-level comparison of three certificate screening policies.
Results describe controlled corruptions of measured output, not verified fraud.
"""
from pathlib import Path
import json,hashlib
import numpy as np
import pandas as pd
from scipy.stats import t
HERE=Path(__file__).resolve().parent
POLICIES=['capacity_guard_only','rolling_z_fixed_3','ewma_calibrated_1pct']

def solar_night(index,lat,lon):
 doy=index.dayofyear.to_numpy();hour=index.hour.to_numpy()
 f=2*np.pi/365*(doy-1+(hour-12)/24)
 decl=.006918-.399912*np.cos(f)+.070257*np.sin(f)-.006758*np.cos(2*f)+.000907*np.sin(2*f)-.002697*np.cos(3*f)+.001480*np.sin(3*f)
 eq=229.18*(.000075+.001868*np.cos(f)-.032077*np.sin(f)-.014615*np.cos(2*f)-.040849*np.sin(2*f))
 ha=np.radians(((hour*60+eq+4*lon)%1440)/4-180)
 elev=np.degrees(np.arcsin(np.clip(np.sin(np.radians(lat))*np.sin(decl)+np.cos(np.radians(lat))*np.cos(decl)*np.cos(ha),-1,1)))
 return elev < -6

def windows(x):
 # A regular hourly index preserves calendar gaps. Only finite past values
 # enter reference windows; no imputation or use of future/current values.
 idx=np.full((len(x),30),-1,dtype=int)
 for i in range(len(x)):
  prior=np.arange(i-24,max(-1,i-45*24-1),-24)[::-1]
  prior=prior[prior>=0];prior=prior[np.isfinite(x[prior])]
  if len(prior)>=30:idx[i]=prior[-30:]
 return idx

def scores(values,widx):
 w=values[widx];flat=w.mean(axis=1);sd=np.maximum(w.std(axis=1,ddof=1),1.)
 q=.5*.5**np.arange(29,-1,-1);q/=q.sum()
 return np.abs((values[np.arange(len(values))]-flat)/sd),np.abs((values-w@q)/sd)

def prf(y,alarm):
 tp=int((y&alarm).sum());fp=int((~y&alarm).sum());fn=int((y&~alarm).sum())
 p=tp/(tp+fp) if tp+fp else 0.;r=tp/(tp+fn) if tp+fn else 0.
 return dict(TP=tp,FP=fp,FN=fn,P=p,R=r,F1=2*p*r/(p+r) if p+r else 0.)

def inject(x,test,rate,seed,capacity,night):
 rng=np.random.default_rng(seed);v=x.copy();y=np.zeros(len(x),bool)
 selected=rng.choice(test,int(len(test)*rate),replace=False)
 for i in selected:
  if night[i]:v[i]=rng.uniform(.05,.20)*capacity
  else:
   kind=rng.integers(0,5)
   v[i]=[x[i]*1.5,x[i]*2.5,x[i]*.5,0.,x[i]*rng.uniform(.05,.15)][kind]
  y[i]=not np.isclose(v[i],x[i],atol=1e-8,rtol=0.)
 return v,y

def summary(a):
 a=np.asarray(a,float);return {'mean':float(a.mean()),'ci95_halfwidth':float(t.ppf(.975,len(a)-1)*a.std(ddof=1)/np.sqrt(len(a)))}

def main():
 df=pd.read_csv(HERE/'data/pvdaq_hourly_2018.csv',parse_dates=['utc_timestamp'])
 meta=pd.read_csv(HERE/'data/pvdaq_systems_20250729.csv').drop_duplicates('system_id').set_index('system_id')
 allrows=[];siteinfo={};fixtures=[]
 for site in [34,1199,1239]:
  d=df[df.site==site].set_index('utc_timestamp').sort_index()
  index=pd.date_range('2018-01-01','2018-08-01',inclusive='left',freq='h',tz='UTC')
  x=d.kwh.reindex(index).to_numpy();ix=windows(x)
  eligible=(ix[:,0]>=0)&np.isfinite(x)
  cal=eligible&(index<pd.Timestamp('2018-04-17',tz='UTC'))
  test=np.flatnonzero(eligible&(index>=pd.Timestamp('2018-04-17',tz='UTC')))
  # Index -1 occurs only in ineligible windows. Their scores are never used.
  z,e=scores(x,ix)
  threshold=float(np.percentile(e[cal],99))
  assert np.all(ix[eligible] < np.flatnonzero(eligible)[:,None])
  assert np.all((np.flatnonzero(eligible)[:,None]-ix[eligible])%24==0)
  for i in np.flatnonzero(eligible)[::max(1,int(eligible.sum()/4))][:4]:
   fixtures.append({'site':site,'current':float(x[i]),'history':x[ix[i]].tolist(),'lambda':.5,'expected_score':float(e[i])})
  night=solar_night(index,float(meta.loc[site,'latitude']),float(meta.loc[site,'longitude']))
  capacity=float(meta.loc[site,'dc_capacity_kW'])
  siteinfo[site]={'name':str(meta.loc[site,'system_public_name']),'capacity_kw':capacity,
   'calibration_n':int(cal.sum()),'test_n':len(test),'finite_hours':int(np.isfinite(x).sum()),
   'threshold':threshold,'unmodified_test_ewma_alert_rate':float((e[test]>=threshold).mean()),
   'unmodified_test_z_alert_rate':float((z[test]>=3).mean())}
  for rate in [.01,.05]:
   for seed in range(6000,6012):
    v,y=inject(x,test,rate,seed,capacity,night)
    for mode in ['clean','received_history']:
     w=x[ix] if mode=='clean' else v[ix]
     mu=w.mean(axis=1);sd=np.maximum(w.std(axis=1,ddof=1),1.)
     q=.5*.5**np.arange(29,-1,-1);q/=q.sum()
     zs=np.abs((v-mu)/sd);es=np.abs((v-w@q)/sd)
     for policy in POLICIES:
      alarm=np.zeros(len(x),bool) if policy==POLICIES[0] else zs>=3 if policy==POLICIES[1] else es>=threshold
      alarm=alarm | (v > 1.2*capacity)
      alarm=alarm[test];yt=y[test];xt=x[test];vt=v[test]
      row=dict(site=site,rate=rate,seed=seed,history=mode,policy=policy,actual_rate=float(yt.mean()),**prf(yt,alarm))
      excess=np.maximum(vt-xt,0)
      row.update(excess_total_kwh=float(excess.sum()),excess_admitted_kwh=float(excess[~alarm].sum()),
       unmodified_kwh_withheld=float(xt[(~yt)&alarm].sum()),unmodified_kwh_total=float(xt[~yt].sum()),
       alert_rate=float(alarm.mean()),test_n=len(test))
      # Monthly batch equivalents, after screening, use the 1 MWh floor and
      # round quantity once per batch, not once per hourly observation.
      admitted=pd.Series(np.where(alarm,0,vt),index=index[test]).groupby(index[test].strftime('%Y-%m')).sum()
      row['batch_equivalent_kwh']=float(np.floor(admitted[admitted>=1000]).sum())
      row['batch_equivalent_count']=int((admitted>=1000).sum())
      row['excess_rejected_fraction']=float(1-row['excess_admitted_kwh']/row['excess_total_kwh']) if row['excess_total_kwh'] else 0.
      row['unmodified_energy_withheld_fraction']=row['unmodified_kwh_withheld']/row['unmodified_kwh_total']
      allrows.append(row)
 (HERE/'results/workflow_score_fixtures.json').write_text(json.dumps(fixtures,indent=2))
 raw=pd.DataFrame(allrows);raw.to_csv(HERE/'results/site_replications.csv',index=False)
 metrics=['P','R','F1','actual_rate','alert_rate','excess_rejected_fraction','unmodified_energy_withheld_fraction','excess_admitted_kwh','batch_equivalent_kwh']
 summaries=[]
 for keys,g in raw.groupby(['site','rate','history','policy'],sort=True):
  row=dict(zip(['site','rate','history','policy'],keys))
  row.update({m:summary(g[m]) for m in metrics});summaries.append(row)
 output={'protocol':json.loads((HERE/'protocol.json').read_text()),'sites':siteinfo,'summary':summaries,
  'data_sha256':hashlib.sha256((HERE/'data/pvdaq_hourly_2018.csv').read_bytes()).hexdigest()}
 (HERE/'results/site_evaluation.json').write_text(json.dumps(output,indent=2,default=lambda v:v.item()))
 print('SITES',json.dumps(siteinfo,indent=2))
 for row in summaries:
  if row['history']=='received_history':print(row['site'],row['rate'],row['policy'],{m:round(row[m]['mean'],4) for m in ['P','R','F1','excess_rejected_fraction','unmodified_energy_withheld_fraction']})
if __name__=='__main__':main()
