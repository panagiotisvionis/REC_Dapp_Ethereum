import fs from 'node:fs';
import assert from 'node:assert/strict';
import {weightedResidual} from '../cre/screening/rule.ts';
const fixtures=JSON.parse(fs.readFileSync(new URL('./results/workflow_score_fixtures.json',import.meta.url)));
for(const f of fixtures){const score=weightedResidual(f.history,f.current,f.lambda);assert.ok(Math.abs(score-f.expected_score)<1e-10,`${f.site}: ${score} != ${f.expected_score}`);}
console.log(`${fixtures.length} measured-data scores agree between Python and the workflow arithmetic (absolute tolerance 1e-10).`);
