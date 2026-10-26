"""Download the preselected PVDAQ systems and prepare measured hourly energy.
Raw daily objects are cached in scratch; the reproducible processed extract,
metadata, source keys, checksums and coverage diagnostics live in this directory.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,as_completed
import urllib.request,xml.etree.ElementTree as ET,json,hashlib,time,io
import pandas as pd
import numpy as np
HERE=Path(__file__).resolve().parent
CACHE=HERE.parent.parent/'tmp/pvdaq/raw'
BASE='https://oedi-data-lake.s3.amazonaws.com/'
CHANNELS={34:('ac_power_hw__2695',.1,'America/Los_Angeles'),1199:('ac_power__2714',.001,'America/New_York'),1239:('ac_power_metered_kw__3015',1.,'America/New_York')}
# Unit conversions are verified against the supplied PVDAQ metrics metadata.
MANIFEST=HERE/'data/pvdaq_download_manifest.json'
EXPECTED={r['key']:r['sha256'] for r in json.loads(MANIFEST.read_text())} if MANIFEST.exists() else {}
def get(url):
 for i in range(4):
  try:return urllib.request.urlopen(url,timeout=45).read()
  except Exception:
   if i==3:raise
   time.sleep(i+1)
def fetch_one(item):
 site,key=item
 dest=CACHE/str(site)/Path(key).name
 dest.parent.mkdir(parents=True,exist_ok=True)
 if not dest.exists():dest.write_bytes(get(BASE+key))
 data=dest.read_bytes()
 digest=hashlib.sha256(data).hexdigest()
 if key in EXPECTED and digest != EXPECTED[key]: raise ValueError(f'Upstream/cache content changed: {key}')
 return site,key,digest,data

def main():
 tasks=[];metadata={}
 systems=pd.read_csv(HERE/'data/pvdaq_systems_20250729.csv')
 selected=[];climates=set()
 for _,r in systems.sort_values('system_id').iterrows():
  if r.qa_status=='pass' and r.years>=2 and r.dc_capacity_kW>=10 and r.kg_climate not in climates:
   selected.append(int(r.system_id));climates.add(r.kg_climate)
   if len(selected)==3: break
 assert selected==list(CHANNELS),(selected,list(CHANNELS))
 for site,(col,factor,zone) in CHANNELS.items():
  metric=pd.read_parquet(HERE/'data'/f'pvdaq_{site}_metrics.parquet')
  scale=float(metric.set_index('standard_name').loc[col,'calc_scale'])
  assert np.isclose(factor,scale/1000),(site,factor,scale)
  assert systems.set_index('system_id').loc[site,'timezone_or_utc_offset']==zone
 for site in CHANNELS:
  dest=HERE/'data'/f'pvdaq_{site}_metadata.json'
  data=dest.read_bytes() if dest.exists() else get(BASE+f'pvdaq/csv/system_metadata/{site}_system_metadata.json')
  if not dest.exists(): dest.write_bytes(data)
  metadata[site]=json.loads(data)
  from urllib.parse import urlencode
  xml=get(BASE+'?'+urlencode({'list-type':'2','prefix':f'pvdaq/csv/pvdata/system_id={site}/year=2018/','max-keys':1000}))
  root=ET.fromstring(xml);ns={'s':'http://s3.amazonaws.com/doc/2006-03-01/'}
  keys=[x.text for x in root.findall('.//s:Contents/s:Key',ns) if x.text.endswith('.csv')]
  assert len(keys)==365,(site,len(keys))
  tasks.extend((site,key) for key in keys)
 results={site:[] for site in CHANNELS};manifest=[]
 with ThreadPoolExecutor(max_workers=24) as pool:
  futures=[pool.submit(fetch_one,item) for item in tasks]
  for i,future in enumerate(as_completed(futures)):
   site,key,digest,data=future.result();col,factor,zone=CHANNELS[site]
   frame=pd.read_csv(io.BytesIO(data),usecols=lambda c:c in ['measured_on',col])
   if col not in frame: frame[col]=np.nan
   results[site].append(frame)
   manifest.append({'site':site,'key':key,'sha256':digest})
   if (i+1)%100==0:print(f'downloaded {i+1}/{len(tasks)}',flush=True)
 diagnostics={};combined=[]
 for site,frames in results.items():
  col,factor,zone=CHANNELS[site]
  frame=pd.concat(frames,ignore_index=True)
  # Pre-analysis QC: the public CSV schema/units change in August 2018.
  # Use the last complete preceding month, identically for every site, rather
  # than infer a unit correction from observed magnitudes. No detector has
  # been fitted when this decision is made.
  frame=frame[frame.measured_on < '2018-08-01'].copy()
  ts=pd.to_datetime(frame.measured_on,errors='coerce')
  # Explicit treatment of repeated/nonexistent local timestamps at DST changes.
  ts=ts.dt.tz_localize(zone,ambiguous='NaT',nonexistent='NaT').dt.tz_convert('UTC')
  raw=pd.Series(pd.to_numeric(frame[col],errors='coerce').to_numpy()*factor,index=pd.DatetimeIndex(ts))
  raw=raw[raw.index.notna()].sort_index();duplicates=int(raw.index.duplicated().sum())
  raw=raw.groupby(level=0).mean()
  cadence=float(round(raw.index.to_series().diff().dt.total_seconds().median()/60)*60)
  expected=3600/cadence
  capacity=float(pd.read_csv(HERE/'data/pvdaq_systems_20250729.csv').set_index('system_id').loc[site,'dc_capacity_kW'])
  too_high=raw > 1.2*capacity
  clipped=raw.clip(lower=0).mask(too_high)
  count=clipped.resample('h',closed='right',label='right').count()
  # Each observation is an interval-average power value at the supplied cadence.
  energy=clipped.resample('h',closed='right',label='right').sum(min_count=1)*cadence/3600
  energy[count < .75*expected]=np.nan
  energy[count>1.25*expected]=np.nan
  out=pd.DataFrame({'site':site,'utc_timestamp':energy.index,'kwh':energy.to_numpy()})
  combined.append(out)
  diagnostics[site]={'rows':len(frame),'cadence_seconds':cadence,'duplicates_averaged':duplicates,
   'negative_power_clipped':int((raw<0).sum()),'above_capacity_samples_excluded':int(too_high.sum()),'capacity_bound_kw':1.2*capacity,'finite_hours':int(energy.notna().sum()),'hours':len(energy),
   'energy_kwh':float(energy.sum()),'max_hour_kwh':float(energy.max()),'channel':col,'factor_to_kw':factor,'timezone':zone}
 pd.concat(combined,ignore_index=True).to_csv(HERE/'data/pvdaq_hourly_2018.csv',index=False,float_format='%.8f')
 manifest.sort(key=lambda x:(x['site'],x['key']))
 (HERE/'data/pvdaq_download_manifest.json').write_text(json.dumps(manifest,indent=2))
 (HERE/'results/pvdaq_data_quality.json').write_text(json.dumps(diagnostics,indent=2))
 print(json.dumps(diagnostics,indent=2),flush=True)
if __name__=='__main__':main()
