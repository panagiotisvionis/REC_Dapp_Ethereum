"""Recompute the corrected aligned-ranks test and frozen-threshold evaluation.

Inputs: the v1.0.1-ee-submission synthetic replication results and Greek hourly
generation extract from github.com/panagiotisvionis/REC_Dapp_Ethereum.
This script does not modify the repository or claim to rerun contract tests.
Run: python3 analysis/verify_revision.py (from the source-package directory).
"""
from pathlib import Path
import json
import hashlib
import sys
import numpy as np
from scipy.stats import rankdata, chi2, norm, t

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import evaluate_real as er
er.DATA = HERE / 'data/gr_generation_hourly.csv'

def summarise(a):
    a = np.asarray(a, dtype=float)
    return {'mean': float(a.mean()), 'ci95_halfwidth': float(t.ppf(.975,len(a)-1)*a.std(ddof=1)/np.sqrt(len(a)))}

def aligned_ranks():
    data = json.loads((HERE/'archived_results/honest_evaluation.json').read_text())
    names = list(data['detectors'])
    X = np.array([data['detectors'][name]['F1'] for name in names])
    k, n = X.shape
    ranks = rankdata(-(X-X.mean(axis=0)).ravel()).reshape(k, n)
    treatment_sums, block_sums = ranks.sum(axis=1), ranks.sum(axis=0)
    # Correct centring term. The archived implementation erroneously divided
    # this term by k*n; ranks and pairwise normal statistics were unaffected.
    numerator = (k-1)*(np.sum(treatment_sums**2) - (k*n*n/4)*(k*n+1)**2)
    denominator = k*n*(k*n+1)*(2*k*n+1)/6 - np.sum(block_sums**2)/k
    statistic = numerator/denominator
    means = ranks.mean(axis=1)
    order = np.argsort(means)
    control = order[0]
    se = np.sqrt(k*(n*k+1)/6)
    raw = {i: float(2*norm.sf(abs(means[control]-means[i])/se)) for i in order[1:]}
    adjusted, running = {}, 0.
    for rank, i in enumerate(sorted(raw, key=raw.get), 1):
        running = max(running, float(-np.expm1((len(raw)/rank)*np.log1p(-raw[i]))))
        adjusted[i] = min(running, 1.)
    return {'statistic': float(statistic), 'df': k-1, 'p': float(chi2.sf(statistic,k-1)),
            'control': names[control], 'rows': [dict(detector=names[i],aligned_rank=float(means[i]),
                finner_p=adjusted.get(i)) for i in order]}

def inject_partition(values, wins, srcs, night, cap, rate, seed):
    """Reproduce the actual four non-night categories in the archived measured
    experiment. Its integer upper bound excludes zero_reading. Unlike the
    archived calibration script, inject separately within each partition and
    estimate the source capacity proxy from calibration data only.
    """
    rng = np.random.default_rng(seed)
    v = values.copy()
    y = np.zeros(len(v),dtype=int)
    categories = ['large_spike','large_dropout','moderate_spike','sensor_stuck']
    idx = rng.choice(len(v),int(len(v)*rate),replace=False)
    for i in idx:
        sd = max(float(wins[i].std(ddof=1)),1.)
        if srcs[i]=='Solar' and night[i]:
            v[i] = rng.uniform(.05,.20)*cap[i]
        else:
            name = categories[rng.integers(0,len(categories))]
            v[i] = max(0.,er.ANOMALIES[name](values[i],sd,rng))
        y[i]=1
    return v,y

def chronological():
    values,wins,srcs,hours,dates = er.build_table(er.load_grid())
    night = er.solar_elevation(list(dates),hours.astype(float)) < -6.
    cut = np.sort(dates)[int(len(values)*.4)]
    cal = np.asarray([d<cut for d in dates]); test=~cal
    cap = np.maximum(wins.max(axis=1),1.)
    for source in np.unique(srcs):
        mask=srcs==source
        cap[mask]=np.maximum(cap[mask],np.percentile(values[cal & mask],99))
    arrays={name:(values[m],wins[m],srcs[m],night[m],cap[m]) for name,m in [('cal',cal),('test',test)]}
    def scores(v,w,s,n,lam):
        return er.s_z(v,w,n,s=='Solar') if lam is None else er.s_ewma(v,w,n,s=='Solar',lam=lam)
    v,w,s,n,c=arrays['cal']
    candidates=[.05,.1,.2,.3,.5,.7,.9]
    selection={}
    for lam in candidates:
        f=[]
        for seed in range(4000,4012):
            vi,y=inject_partition(v,w,s,n,c,.01,seed)
            sc=scores(vi,w,s,n,lam)
            threshold=np.percentile(sc,99)
            f.append(er.prf(y,(sc>=threshold).astype(int))[2])
        selection[str(lam)]=float(np.mean(f))
    lam_star=float(max(selection,key=selection.get))
    thresholds={}
    for name,lam in [('z',None),('ewma',lam_star)]:
        sc=scores(v,w,s,n,lam)
        thresholds[name]={str(rate):float(np.percentile(sc,100*(1-rate))) for rate in [.01,.005,.001]}
    alerts={}
    v,w,s,n,c=arrays['test']
    for name,lam in [('z',None),('ewma',lam_star)]:
        sc=scores(v,w,s,n,lam)
        alerts[name]={rate:float(np.mean(sc>=thr)) for rate,thr in thresholds[name].items()}
    rows={}
    for rate in [.005,.01,.05,.1]:
        row={}
        for name,lam in [('z',None),('ewma',lam_star)]:
            metrics=[]
            for seed in range(5000,5012):
                vi,y=inject_partition(v,w,s,n,c,rate,seed)
                sc=scores(vi,w,s,n,lam)
                pred=(sc>=thresholds[name]['0.01']).astype(int)
                metrics.append([*er.prf(y,pred),float(pred.mean())])
            row[name]={key:summarise(np.array(metrics)[:,i]) for i,key in enumerate(['P','R','F1','alarm_rate'])}
        rows[str(rate)]=row
    return {'cut':str(cut),'n_cal':int(cal.sum()),'n_test':int(test.sum()),
        'selection':selection,'lambda_star':lam_star,'thresholds':thresholds,
        'unmodified_test_alerts':alerts,'frozen_1pct_threshold_test':rows,
        'seeds_calibration':[4000,4011],'seeds_test':[5000,5011],
        'notes':'CIs condition on the same measured series and vary injected anomalies only; '
                'injection labels do not establish natural data are anomaly-free. '
                'The four non-night categories match the actual archived measured generator. '
                'Thresholds and source-level capacity proxy are estimated on calibration only.'}

if __name__=='__main__':
    result={'aligned_ranks_F1':aligned_ranks(),'chronological':chronological(),
        'sha256_data':hashlib.sha256(er.DATA.read_bytes()).hexdigest()}
    (HERE/'results').mkdir(exist_ok=True)
    (HERE/'results/revision_verification.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result,indent=2))
