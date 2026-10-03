import {test, expect} from '@playwright/test';

// Invented contract records exercise delivery and readiness without redistributing captures.
function capture(geometry: boolean) {
  const header = JSON.stringify({spot:'s1', points:2, views:['v1']});
  const padded = Math.ceil(header.length/4)*4;
  const bytes = Buffer.alloc(8+padded+42, 0);
  bytes.write('MRP1'); bytes.writeUInt32LE(padded,4); bytes.fill(32,8,8+padded); bytes.write(header,8);
  for (let i=0;i<6;i++) bytes.writeFloatLE(i+.5,8+padded+i*4);
  for (let i=0;i<6;i++) bytes[8+padded+36+i]=100+i*20;
  const id = geometry ? 'cusco-qorikancha' : 'kathmandu-swayambhu';
  return {bytes, record:{schema:'mercature-route/1',id,synthetic:false,local_only:true,title:'Test source',place:'Test record',
    route:{frame:{axes:'east-north-up',origin:[0,0,0]},line:[[0,0],[.001,.001]]},request:{destination:{name:'Target',position:[.001,.001]}},
    photos:[{id:'p1',position:[0,0],heading:0,captured_at:null,creator:{username:'Fixture'},licence:'Fixture only',link:null,file:null,thumb:null}],
    views:[{id:'v1',photo_id:'p1',file:'views/v1.jpg',width:2,height:2,cut:null}],
    spots: geometry ? [{id:'s1',state:'joined',views:['v1'],center:[0,0],piece:{file:'pieces/s1.bin',points:2,bytes:bytes.length,model:'fixture',residual_rms_m:0}}] : [],
    findings:[],sources:[],map_context:{buildings:{features:[]},ways:{features:[]}}}};
}

test('captured preparation waits for actual geometry and rendering before entering that destination', async ({page}) => {
  const fixture=capture(true);
  let release!: () => void;
  const held = new Promise<void>(resolve => {release=resolve;});
  await page.route('**/routes/**/route.json', route => route.fulfill({json:fixture.record}));
  await page.route('**/routes/**/pieces/*.bin', async route => {await held; await route.fulfill({contentType:'application/octet-stream',body:fixture.bytes});});
  await page.route('**/routes/**/views/*.jpg', route => route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aBZkAAAAASUVORK5CYII=','base64')}));
  await page.goto('/');
  await page.getByRole('button',{name:'Explore Qorikancha · Cusco'}).click();
  await expect(page.getByText('1 view · 1 camera')).toBeVisible();
  await page.getByRole('button',{name:'Zoom map in',exact:true}).click();
  const routeLine = page.getByRole('group',{name:'Recorded geographic route and source cameras'}).locator('polyline').first();
  const routePoints = await routeLine.getAttribute('points');
  await page.getByRole('button',{name:'Load scene',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Opening the retained scene…'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Enter scene',exact:true})).toHaveCount(0);
  release();
  await expect(page.getByRole('heading',{name:'Your scene is ready.'})).toBeVisible();
  await page.getByRole('button',{name:'Enter scene',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Qorikancha',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Zoom reconstruction in'})).toBeVisible();
  await page.getByRole('button',{name:'Map',exact:true}).click();
  await expect(routeLine).toHaveAttribute('points',routePoints!);
  await expect(page.getByRole('button',{name:'Check the passage →'})).toHaveCount(0);
});

test('photo-only capture stays photo-only throughout preparation', async ({page}) => {
  await page.route('**/routes/**/route.json', route => route.fulfill({json:capture(false).record}));
  await page.route('**/routes/**/views/*.jpg', route => route.fulfill({status:404}));
  await page.goto('/');
  await page.getByRole('button',{name:'Explore Swayambhu · Kathmandu'}).click();
  await expect(page.getByText('Missing',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Explore the photographs.'})).toBeVisible();
  await expect(page.getByText('This capture has no usable 3D reconstruction.')).toBeVisible();
  await page.getByRole('button',{name:'Enter scene',exact:true}).click();
  await expect(page.getByRole('region',{name:'Geographic source map'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Check the passage →'})).toHaveCount(0);
});
