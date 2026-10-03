/** Offline Node feasibility check; not a browser, phone or reviewed-language acceptance test. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import os from 'node:os';
import { aliasBaseline } from '../../src/language/index.ts';

const model = resolve(process.argv[2] ?? '.local/language/model');
const library = resolve(process.argv[3] ?? '.local/language/runtime/node_modules/@huggingface/transformers/dist/transformers.node.mjs');
const outputPath = resolve(process.argv[4] ?? '.local/language/results.json');
let networkAttempts = 0;
globalThis.fetch = async () => { networkAttempts++; throw new Error('Network disabled for local benchmark'); };
const { env, pipeline } = await import(pathToFileURL(library).href);
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.useBrowserCache = false;
const started = performance.now();
const extractor = await pipeline('feature-extraction', model, {
  dtype: 'q8', device: 'cpu', local_files_only: true,
  session_options: { intraOpNumThreads: 2, interOpNumThreads: 1 },
});
const loadMs = performance.now() - started;
async function embed(texts) {
  const tensor = await extractor(texts, { pooling: 'mean', normalize: true, truncation: true, max_length: 128 });
  const vectors = tensor.tolist();
  if (vectors.length !== texts.length || vectors.some(vector => vector.length !== 384 || vector.some(value => !Number.isFinite(value)))) throw new Error('Invalid embedding output');
  return vectors;
}
const dot = (a,b) => a.reduce((sum,x,i) => sum + x * b[i], 0);
const baseline = (text, inventory) => aliasBaseline(text, inventory).suggestions.map(item => item.id);
function metrics(cases, key) {
  let targets=0, hits=0, emitted=0, wrong=0, noMatch=0, abstained=0, multi=0, covered=0, exact=0;
  for(const c of cases) {
    const ids=c[key]; targets+=c.targets.length; emitted+=ids.length;
    hits+=c.targets.filter(id=>ids.includes(id)).length;
    wrong+=ids.filter(id=>!c.targets.includes(id)).length;
    if(!c.targets.length) { noMatch++; if(!ids.length) abstained++; }
    if(c.targets.length>1) { multi++; if(c.targets.every(id=>ids.includes(id))) covered++; }
    if(ids.length===c.targets.length && c.targets.every(id=>ids.includes(id))) exact++;
  }
  return {targets,hits,emitted,wrong,noMatch,abstained,multi,covered,exact,
    targetRecall:hits/targets,wrongFraction:emitted?wrong/emitted:0,noMatchRecall:abstained/noMatch,multiCoverage:covered/multi};
}
const reports = [];
let lastIndex;
for(const suite of ['controls','evaluation']) {
  const contents = await readFile(new URL(`./${suite}.json`, import.meta.url),'utf8');
  const fixture=JSON.parse(contents);
  const indexStart=performance.now();
  const vectors = await embed(fixture.inventory.map(item=>`passage: ${item.label}`));
  const indexMs=performance.now()-indexStart;
  lastIndex={fixture,vectors};
  const cases=[];
  for(const test of fixture.cases) {
    const begin=performance.now();
    const [query]=await embed([`query: ${test.text}`]);
    const ranked=fixture.inventory.map((item,i)=>({id:item.id,score:dot(query,vectors[i])})).sort((a,b)=>b.score-a.score);
    const selected=ranked.filter(item=>item.score>=0.85 && item.score>=ranked[0].score-0.04).slice(0,3).map(item=>item.id);
    cases.push({...test,embeddingSha256:createHash('sha256').update(JSON.stringify(query)).digest('hex'),embeddingDimensions:query.length,ranked,selected,baseline:baseline(test.text,fixture.inventory),latencyMs:performance.now()-begin});
  }
  reports.push({suite,inputSha256:createHash('sha256').update(contents).digest('hex'),indexMs,indexBytes:JSON.stringify(vectors).length,cases,model:metrics(cases,'selected'),alias:metrics(cases,'baseline')});
}
const sustained=[];
for(let i=0;i<30;i++) {
  const before=performance.now();
  const [query]=await embed([`query: Visitor ${i+1}: I could not read the hours at the northern entry.`]);
  const scores=lastIndex.vectors.map(vector=>dot(query,vector));
  sustained.push({embeddingSha256:createHash('sha256').update(JSON.stringify(query)).digest('hex'),latencyMs:performance.now()-before,rss:process.memoryUsage().rss,finite:scores.every(Number.isFinite)});
}
const latencies=reports.flatMap(r=>r.cases.map(c=>c.latencyMs)).concat(sustained.map(c=>c.latencyMs)).sort((a,b)=>a-b);
const report={uniqueSustainedEmbeddings:new Set(sustained.map(item=>item.embeddingSha256)).size,runtime:'@huggingface/transformers@3.8.1; ONNX CPU q8; two inference threads',node:process.version,platform:process.platform,architecture:process.arch,cpu:os.cpus()[0].model,totalMemory:os.totalmem(),loadMs,p95Ms:latencies[Math.ceil(latencies.length*.95)-1],maxRssBytes:process.resourceUsage().maxRSS*1024,networkAttempts,reports,sustained};
await mkdir(resolve(outputPath,'..'),{recursive:true});
await writeFile(outputPath,JSON.stringify(report,null,2));
console.log(JSON.stringify({loadMs:report.loadMs,p95Ms:report.p95Ms,maxRssBytes:report.maxRssBytes,networkAttempts,reports:reports.map(({suite,model,alias})=>({suite,model,alias}))},null,2));
await extractor.dispose();
