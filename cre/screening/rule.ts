/** Shared executable rule. Test this module itself, not a copied implementation. */
export type Reading = { timestampUtc: string; kwh: number };
export type ScreenConfig = {
  threshold: number; lambda: number; windowDays: number; minKwh: number;
  maxReadingAgeSeconds: number; maxHistoryAgeDays: number; maxKwh: number;
};
export function screen(current: Reading | undefined, history: Reading[], cfg: ScreenConfig, nowMs: number) {
  const reject = (reason: string) => ({ reject: reason } as const);
  if (![cfg.threshold,cfg.lambda,cfg.windowDays,cfg.minKwh,cfg.maxReadingAgeSeconds,cfg.maxHistoryAgeDays,cfg.maxKwh,nowMs].every(Number.isFinite) || cfg.threshold <= 0 || cfg.lambda <= 0 || cfg.lambda >= 1 ||
      !Number.isInteger(cfg.windowDays) || cfg.windowDays < 2 || cfg.windowDays > 366 ||
      cfg.maxHistoryAgeDays < cfg.windowDays || cfg.maxReadingAgeSeconds <= 0 || cfg.minKwh < 1000 || cfg.maxKwh < cfg.minKwh)
    return reject('invalid policy');
  if (!current || !Number.isFinite(current.kwh) || current.kwh < 0) return reject('invalid reading');
  if (current.kwh > cfg.maxKwh) return reject('exceeds physical bound');
  const parse = (s: string) => typeof s === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(s) ? Date.parse(s) : NaN;
  const time = parse(current.timestampUtc);
  if (!Number.isFinite(time) || time > nowMs || nowMs-time > cfg.maxReadingAgeSeconds*1000)
    return reject('invalid or stale timestamp');
  if (time % 3600000 !== 0) return reject('reading is not an aligned hourly interval');
  if (!Array.isArray(history)) return reject('invalid history');
  const hour = new Date(time).getUTCHours();
  const seen = new Set<number>();
  const prior: { time: number; kwh: number }[] = [];
  for (const r of history) {
    if (!r) return reject('invalid history');
    const t = parse(r.timestampUtc);
    if (!Number.isFinite(t) || t >= time || !Number.isFinite(r.kwh) || r.kwh < 0 || seen.has(t))
      return reject('invalid, repeated or non-prior history');
    seen.add(t);
    if (new Date(t).getUTCHours() === hour && t % 3600000 === 0 && time-t <= cfg.maxHistoryAgeDays*86400000)
      prior.push({time:t,kwh:r.kwh});
  }
  prior.sort((a,b)=>a.time-b.time);
  const selected=prior.slice(-cfg.windowDays);
  if (selected.length < cfg.windowDays) return reject('insufficient history');
  const score=weightedResidual(selected.map(r=>r.kwh),current.kwh,cfg.lambda);
  if (!Number.isFinite(score)) return reject('nonfinite reference statistic');
  if(score >= cfg.threshold)return reject('score above threshold');
  if(current.kwh < cfg.minKwh)return reject('below 1 MWh issuance floor');
  return {kwh:Math.floor(current.kwh),start:Math.floor(time/1000)-3600,end:Math.floor(time/1000),
    evidence:JSON.stringify({reading:current,history:selected,score,rule:'ewma-residual-v2'}),
    policy:JSON.stringify({rule:'ewma-residual-v2',threshold:cfg.threshold,lambda:cfg.lambda,windowDays:cfg.windowDays,minKwh:cfg.minKwh,maxReadingAgeSeconds:cfg.maxReadingAgeSeconds,maxHistoryAgeDays:cfg.maxHistoryAgeDays,maxKwh:cfg.maxKwh})};
}

/** Arithmetic shared by the workflow and the cross-language evaluation check. */
export function weightedResidual(xs:number[],current:number,lambda:number):number {
  const flat=xs.reduce((a,b)=>a+b,0)/xs.length;
  const sd=Math.sqrt(xs.reduce((a,b)=>a+(b-flat)**2,0)/(xs.length-1));
  let num=0,den=0;
  for(let i=0;i<xs.length;i++){const w=lambda*(1-lambda)**(xs.length-1-i);num+=w*xs[i];den+=w;}
  const mean=num/den;
  if (![flat,sd,mean].every(Number.isFinite)) return NaN;
  return Math.abs((current-mean)/Math.max(sd,1));
}
