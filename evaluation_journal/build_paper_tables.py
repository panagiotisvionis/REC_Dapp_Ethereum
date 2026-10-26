"""Generate publication tables and the energy figure from recorded results."""
from pathlib import Path
import json
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
HERE=Path(__file__).resolve().parent
OUT=HERE.parent/'paper/generated'
OUT.mkdir(parents=True,exist_ok=True)
d=json.loads((HERE/'results/site_evaluation.json').read_text())
policies=['capacity_guard_only','rolling_z_fixed_3','ewma_calibrated_1pct']
names=['Capacity only','Rolling z','EWMA']
rows={(r['site'],r['rate'],r['policy']):r for r in d['summary'] if r['history']=='received_history'}
def table(name,caption,label,columns,header,body):
 text='\\begin{table}[tb]\\centering\\small\n'+f'\\caption{{{caption}}}\\label{{{label}}}\n'
 text+=f'\\begin{{tabular}}{{@{{}}{columns}@{{}}}}\\toprule\n'+header+'\\\\\\midrule\n'
 text+='\n'.join(body)+'\n\\bottomrule\\end{tabular}\\end{table}\n'
 (OUT/name).write_text(text)
def ci(r,m):return f"${r[m]['mean']:.3f}\\pm{r[m]['ci95_halfwidth']:.3f}$"
body=[]
climates={34:'Bwh',1199:'Cfa',1239:'Dfb'}
for sid,x in d['sites'].items():
 body.append(f"{sid} ({climates[int(sid)]}) & {x['capacity_kw']:.2f} & {x['finite_hours']:,} & {x['calibration_n']:,} & {x['test_n']:,} & {x['threshold']:.3f}\\\\")
table('site_metadata.tex','PVDAQ sites and retained UTC hourly records, January--July 2018. Thresholds use calibration only. Climate codes follow the public system metadata.','tab:sites','lrrrrr','System (climate) & DC kW & Finite hours & Calibration & Test & EWMA threshold',body)
body=[]
for sid in [34,1199,1239]:
 for rate in [.01,.05]:
  body.append(f'{sid} & {rate*100:.0f}\\% & '+' & '.join(ci(rows[sid,rate,p],'F1') for p in policies)+r'\\')
table('site_f1.tex','F1 under received-data histories. Values are mean $\\pm$ conditional 95\\% confidence half-width over twelve intervention seeds. Rates denote attempted interventions, not verified fraud prevalence.','tab:sitef1','lrrrr','System & Rate & Capacity only & Rolling z & EWMA',body)
body=[]
for sid in [34,1199,1239]:
 for policy,name in zip(policies,names):
  r=rows[sid,.01,policy]
  body.append(f"{sid} & {name} & {r['R']['mean']:.3f} & {r['excess_admitted_kwh']['mean']:.2f} & {100*r['excess_rejected_fraction']['mean']:.2f} & {100*r['unmodified_energy_withheld_fraction']['mean']:.3f}\\\\")
table('site_energy.tex','Received-history outcomes at 1\\% attempted intervention. Energy columns are seed means; figure whiskers and the supplied replication results quantify uncertainty. Withheld energy excludes intervened readings.','tab:siteenergy','llrrrr','System & Policy & Recall & Excess admitted (kWh) & Excess rejected (\\%) & Withheld (\\%)',body)
gas=json.loads((HERE/'results/gas_v2.json').read_text())['samples']
body=[]
for k,name in [('manual','Manual issuance'),('workflow_one_meter','Workflow, one meter'),('workflow_three_meters','Workflow, three meters')]:
 v=np.array(gas[k]);body.append(f'{name} & {v[0]:,} & {np.mean(v[1:]):,.0f} & {np.mean(v):,.0f}'+r'\\')
table('gas_v2.tex','Local EVM execution gas for the revised contracts; fifteen transactions per case. Service, report transport and off-chain execution charges are excluded.','tab:gasv2','lrrr','Case & First transaction & Following 14 mean & All 15 mean',body)
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':9,'axes.spines.top':False,'axes.spines.right':False,'pdf.fonttype':42})
fig,axes=plt.subplots(1,2,figsize=(7.0,2.9),layout='constrained')
x=np.arange(3);width=.24
colors=['#8B9298','#336A9C','#CC7A28']
for j,(p,name,c) in enumerate(zip(policies,names,colors)):
 for ax,m in zip(axes,['excess_rejected_fraction','unmodified_energy_withheld_fraction']):
  vals=[100*rows[s,.01,p][m]['mean'] for s in [34,1199,1239]]
  errs=[100*rows[s,.01,p][m]['ci95_halfwidth'] for s in [34,1199,1239]]
  ax.bar(x+(j-1)*width,vals,width,label=name,color=c,yerr=errs,capsize=2,error_kw={'elinewidth':.7})
for ax,title in zip(axes,['Injected excess energy rejected (%)','Unmodified energy withheld (%)']):
 ax.set_xticks(x,['34','1199','1239']);ax.set_xlabel('PVDAQ system');ax.set_title(title,fontsize=9);ax.set_ylim(bottom=0);ax.grid(axis='y',alpha=.15);ax.set_axisbelow(True)
axes[0].set_ylim(0,110);axes[1].set_ylim(0,2.2)
fig.legend(names,loc='outside lower center',ncol=3,frameon=False,fontsize=8)
fig.savefig(OUT/'site_energy.pdf');fig.savefig(OUT/'site_energy.png',dpi=200)
print('Generated four tables and energy figure.')
