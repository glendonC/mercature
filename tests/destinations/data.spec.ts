import {test,expect} from '@playwright/test';
import {decodeCloud,localAsset,metres,parseDestination,type Piece} from '../../src/destinations/data';
import {parseReview} from '../../src/decisions/store';

/** Invented contract records for parser tests only; never shipped as a destination. */
function contract() {return {
  schema:'mercature-route/1',id:'cusco-qorikancha',synthetic:false,local_only:true,title:'Parser fixture',place:'Test record',
  route:{frame:{axes:'east-north-up',origin:[0,0,0]},line:[[0,0],[.001,.001]]},request:{destination:{name:'Target',position:[.001,.001]}},
  photos:[{id:'p1',position:[0,0],heading:0,computed_position:[0,.00001],computed_heading:90,captured_at:null,creator:{username:'Fixture'},licence:'CC-BY-SA-4.0',link:null,file:null,thumb:'thumbs/p1.jpg'}],
  views:[{id:'v1',photo_id:'p1',file:'views/v1.jpg',width:100,height:100,cut:null}],spots:[],findings:[],sources:[],
  map_context:{buildings:{features:[{geometry:{type:'Polygon',coordinates:[[[0,0],[.01,0],[.01,.01],[0,0]],[[.001,.001],[.002,.001],[.002,.002],[.001,.001]]]},properties:{name:'Building'}}]},ways:{features:[{geometry:{type:'MultiLineString',coordinates:[[[0,0],[.001,0]],[[.001,0],[.002,0]]]},properties:{}}]}},
};}

test('local route adapter preserves source links, geographic correction and building holes',()=>{
 const result=parseDestination(contract(),'cusco-qorikancha');expect(result.localOnly).toBe(true);expect(result.photos[0].position).toEqual([0,.00001]);expect(result.photos[0].heading).toBe(90);expect(result.buildings).toHaveLength(1);expect(result.buildings[0].holes).toHaveLength(1);expect(result.ways).toHaveLength(2);expect(result.views[0].photoId).toBe('p1');
 const input=contract();input.photos[0].computed_position=[0,.01];const fallback=parseDestination(input,'cusco-qorikancha');expect(fallback.photos[0].position).toEqual([0,0]);expect(fallback.photos[0].heading).toBe(0);expect(metres([0,.001],[0,0])[1]).toBeCloseTo(111.195,2);
});

test('route entry rejects nonlocal provenance, cross-site identity and unsafe paths',()=>{
 for(const changes of [{local_only:false},{synthetic:true},{schema:'other'},{id:'tbilisi-narikala'}])expect(()=>parseDestination({...contract(),...changes},'cusco-qorikancha')).toThrow();
 for(const file of ['../secret.jpg','https://example.com/image.jpg','views/other.jpg']){const data=contract();data.views[0].file=file;expect(()=>parseDestination(data,'cusco-qorikancha')).toThrow();}
 const data=contract();data.views[0].photo_id='missing';expect(()=>parseDestination(data,'cusco-qorikancha')).toThrow(/source/);
 const bad=contract();bad.photos[0].position=[181,0];expect(()=>parseDestination(bad,'cusco-qorikancha')).toThrow();
});

test('asset URLs require localhost and never allow path or origin escapes',()=>{
 const host={hostname:'127.0.0.1',protocol:'http:'} as Location;
 expect(localAsset('cusco-qorikancha','views/v1.jpg',host)).toBe('/routes/cusco-qorikancha/views/v1.jpg');
 for(const file of ['../route.json','/views/v1.jpg','views/%2e%2e.jpg','//example.com/a.jpg'])expect(()=>localAsset('cusco-qorikancha',file,host)).toThrow();
 expect(()=>localAsset('cusco-qorikancha','route.json',{...host,hostname:'example.com'} as Location)).toThrow(/local-only/);
 expect(()=>localAsset('cusco-qorikancha','route.json',{...host,protocol:'file:'} as Location)).toThrow(/local-only/);
});
function binary(){
 const json=JSON.stringify({spot:'s1',points:2,views:['v1']});const size=Math.ceil(json.length/4)*4;const bytes=new Uint8Array(8+size+42);bytes.set(new TextEncoder().encode('MRP1'));const data=new DataView(bytes.buffer);data.setUint32(4,size,true);bytes.fill(32,8,8+size);bytes.set(new TextEncoder().encode(json),8);for(let i=0;i<6;i++)data.setFloat32(8+size+i*4,i+.5,true);bytes.set([20,30,40,50,60,70],8+size+36);
 const expected:Piece={id:'s1',file:'pieces/s1.bin',points:2,bytes:bytes.length,views:['v1'],center:[0,0],model:'fixture',residual:0};return {bytes,expected,at:8+size};
}
test('binary geometry retains exact source positions and colours without fabricated points',()=>{
 const {bytes,expected}=binary(),result=decodeCloud(bytes.buffer,expected);expect([...result.positions]).toEqual([.5,1.5,2.5,3.5,4.5,5.5]);expect([...result.colours]).toEqual([20,30,40,50,60,70]);expect(result.views).toEqual(['v1']);
});
test('binary geometry rejects nonfinite points, broken source bindings and truncated assets',()=>{
 const {bytes,expected,at}=binary();expect(()=>decodeCloud(bytes.buffer.slice(0,-1),expected)).toThrow();expect(()=>decodeCloud(bytes.buffer,{...expected,id:'s2'})).toThrow();expect(()=>decodeCloud(bytes.buffer,{...expected,views:['other']})).toThrow();
 const invalid=bytes.slice();new DataView(invalid.buffer).setFloat32(at,NaN,true);expect(()=>decodeCloud(invalid.buffer,expected)).toThrow();
 const index=bytes.slice();new DataView(index.buffer).setUint16(at+24,1,true);expect(()=>decodeCloud(index.buffer,expected)).toThrow(/source/);
});


test('photo findings stay bound to their source photograph and image dimensions',()=>{
 const finding={id:'finding-1',view_id:'v1',photo_id:'p1',label:'Recorded outline',outline:[[0,0],[100,0],[100,100]],verified:false};
 const source=contract();
 const valid={...source,findings:[finding]};
 expect(parseDestination(valid,'cusco-qorikancha').findings[0].outline).toEqual(finding.outline);
 const secondPhoto={...source.photos[0],id:'p2',thumb:'thumbs/p2.jpg'};
 const secondView={...source.views[0],id:'v2',photo_id:'p2',file:'views/v2.jpg'};
 expect(()=>parseDestination({...valid,photos:[...source.photos,secondPhoto],views:[...source.views,secondView],findings:[{...finding,view_id:'v2'}]},'cusco-qorikancha')).toThrow(/photograph does not match/);
 for(const point of [[100.01,20],[20,100.01],[-.01,20],[20,-.01]]) {
  expect(()=>parseDestination({...valid,findings:[{...finding,outline:[point,[20,20],[30,30]]}]},'cusco-qorikancha')).toThrow();
 }
 // Bounds still apply to a source view whose image is not retained.
 expect(()=>parseDestination({...valid,views:[{...source.views[0],file:null}],findings:[{...finding,outline:[[101,20]]}]},'cusco-qorikancha')).toThrow();
});

test('a stored answer keeps a first spot remembered from past links, and older answers still read', () => {
  const record = (answer: unknown) => JSON.stringify({schema:'mercature-route-review/1',place:'cusco-qorikancha',decisions:{},messages:[{id:'m1',text:'Parser fixture message',language:'other',at:'2026-10-04T01:00:00.000Z',answer,spot:null}]});
  const older = {status:'unsure',kind:null,category:null,candidates:['steps-340-350'],model:null};
  expect(parseReview(record(older),'cusco-qorikancha').messages[0].answer).toEqual(older);
  expect(parseReview(record({...older,remembered:true}),'cusco-qorikancha').messages[0].answer).toEqual({...older,remembered:true});
  expect(() => parseReview(record({...older,remembered:'yes'}),'cusco-qorikancha')).toThrow('remembered');
});
