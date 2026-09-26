const {test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('token','synthetic-assistant-test'));
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    let data=[];
    if(path==='/api/user/profile')data={name:'Preview Citizen',nid:'0123456789',mobile:'01700000000',email:'preview@example.test',dob:'1998-01-02'};
    else if(path==='/api/nid/profile')data={exists:false,based_on_registration:{}};
    else if(path==='/api/nid/dashboard')data={profile:{},stats:{},recentApplications:[]};
    else if(/stats$|dashboard$/.test(path))data={};
    else if(/\/tin\/status$|\/vat\/status$/.test(path))data=null;
    else if(path==='/api/medicine-scans')data={scans:[]};
    else if(path==='/api/passport/my-applications')data=[{id:1,application_number:'DEMO-PASSPORT-1',status:'Under Review',submitted_at:'2026-09-25'}];
    return route.fulfill({body:JSON.stringify(data),contentType:'application/json'});
  });
});
async function openGuide(page,path){
  await page.goto(path);await page.getByRole('button',{name:/Voice assistant/}).click();
  const guide=page.getByRole('region',{name:'NationX voice assistant'});
  await guide.getByLabel('Assistant language').selectOption('en');
  await guide.getByRole('button',{name:'Voice on',exact:true}).click();
  return guide;
}
for(const width of [1440,390]){
  test(`NID guided correction: profile, answers, correction, review and no automatic writes at ${width}`,async({page},testInfo)=>{
    await page.setViewportSize({width,height:1000});
    const writes=[];page.on('request',r=>{if(r.method()!=='GET'&&r.url().includes('/api/nid/'))writes.push(r.url());});
    const guide=await openGuide(page,'/nid.html?section=correction');
    await guide.getByRole('button',{name:'NID correction',exact:true}).click();
    await guide.getByRole('button',{name:'Guide me step by step'}).click();
    await expect(page.locator('main input[name=nid_number]')).toHaveValue('0123456789');
    await guide.getByLabel('Current value',{exact:true}).fill('Old spelling');
    await guide.getByRole('button',{name:'Send',exact:true}).click();
    await expect(page.locator('main textarea[name=current_value]')).toHaveValue('Old spelling');
    await guide.getByLabel('Corrected value',{exact:true}).fill('Correct spelling');
    await guide.getByRole('button',{name:'Send',exact:true}).click();
    await guide.getByRole('button',{name:'Skip optional field'}).click();
    await guide.getByRole('button',{name:'Skip optional field'}).click();
    await expect(guide.getByRole('button',{name:'Review and submit on the form'})).toBeVisible();
    await guide.getByRole('button',{name:'Old spelling',exact:true}).click();
    await guide.getByLabel('Current value',{exact:true}).fill('Revised spelling');
    await guide.getByRole('button',{name:'Send',exact:true}).click();
    await expect(page.locator('main textarea[name=current_value]')).toHaveValue('Revised spelling');
    await expect(guide.getByRole('button',{name:'Review and submit on the form'})).toBeVisible();
    await page.screenshot({path:testInfo.outputPath(`assistant-review-${width}.png`),animations:'disabled'});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await guide.getByRole('button',{name:'Review and submit on the form'}).click();
    await expect(guide).toHaveCount(0);expect(writes).toEqual([]);
    if(width===1440){
      await page.route('**/api/nid/corrections',route=>route.request().method()==='POST'?route.fulfill({json:{request_no:'DEMO-COR-001',message:'Mock request stored'}}):route.fulfill({json:[]}));
      const posted=page.waitForRequest(r=>r.url().endsWith('/api/nid/corrections')&&r.method()==='POST');
      await page.getByRole('button',{name:'Submit correction',exact:true}).click();
      const request=await posted;
      expect(request.postData()).toContain('Revised spelling');expect(request.postData()).toContain('Correct spelling');
      await expect(page.getByText('Mock request stored')).toBeVisible();
    }
  });
}
test('live status displays server values and reports failed refresh without stale results',async({page})=>{
  const guide=await openGuide(page,'/passport.html');
  await guide.getByRole('button',{name:'Passport application',exact:true}).click();
  await guide.getByRole('button',{name:'Check my status'}).click();
  await expect(guide).toContainText('DEMO-PASSPORT-1');await expect(guide).toContainText('Under Review');
  await page.route('**/api/passport/my-applications',route=>route.fulfill({status:503,json:{error:'Status service unavailable'}}));
  await guide.getByRole('button',{name:'Refresh status'}).click();
  await expect(guide.getByRole('alert')).toContainText('Status service unavailable');
  await expect(guide).not.toContainText('DEMO-PASSPORT-1');
});

for(const [ministry,section,title] of [['health','health-card','Health card'],['agriculture','subsidies','Farm subsidy'],['nid','profile','NID profile'],['passport','apply','Passport application'],['water','connection','Water connection'],['land','mutation','Land mutation'],['tax','tin','TIN registration'],['education','results','Exam results']]){
  test(`${ministry}: guidance uses the rendered service form and resumes after closing`,async({page})=>{
    const guide=await openGuide(page,`/${ministry}.html?section=${section}`);
    await guide.getByRole('button',{name:title,exact:true}).click();
    await guide.getByRole('button',{name:'Guide me step by step'}).click();
    await expect(guide.locator('.nx-guide-progress')).toBeVisible();
    const question=await guide.locator('.nx-guide-field-label').textContent();
    await guide.getByRole('button',{name:'Close assistant panel'}).click();
    await page.getByRole('button',{name:/Voice assistant/}).click();
    await expect(guide.locator('.nx-guide-field-label')).toHaveText(question);
    await expect(guide.getByRole('button',{name:'Voice off',exact:true})).toBeVisible();
  });
}
test('cross-ministry voice/text intent opens the allowlisted service and restores guidance',async({page})=>{
  let guide=await openGuide(page,'/health.html');
  await guide.getByLabel('Message to assistant').fill('water connection');
  await guide.getByRole('button',{name:'Send',exact:true}).click();
  await guide.getByRole('button',{name:'Guide me step by step'}).click();
  await expect(page).toHaveURL(/water.html\?section=connection/);
  guide=page.getByRole('region',{name:'NationX voice assistant'});
  await expect(guide).toBeVisible();
  await expect(page.locator('main input[name=holder_name]')).toHaveValue('Preview Citizen');
});
test('cancel is a control, not an answer; unavailable microphone preserves typed input',async({page})=>{
  const guide=await openGuide(page,'/nid.html?section=correction');
  await guide.getByRole('button',{name:'NID correction',exact:true}).click();
  await guide.getByRole('button',{name:'Guide me step by step'}).click();
  await guide.getByLabel('Current value',{exact:true}).fill('cancel');
  await guide.getByRole('button',{name:'Send',exact:true}).click();
  await expect(page.locator('main textarea[name=current_value]')).toHaveValue('');
  await guide.getByLabel('Message to assistant').fill('keep this draft');
  await page.evaluate(()=>Object.defineProperty(navigator,'mediaDevices',{value:undefined,configurable:true}));
  await guide.getByRole('button',{name:'Speak your answer'}).click();
  await expect(guide.getByRole('alert')).toContainText('Microphone unavailable');
  await expect(guide.getByLabel('Message to assistant')).toHaveValue('keep this draft');
});
