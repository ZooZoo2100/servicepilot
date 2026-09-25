/* global document, innerWidth */
import process from "node:process";
import console from "node:console";
import 'dotenv/config';
import {mkdirSync} from 'node:fs';
const evidenceDir=process.env.VERIFY_SCREENSHOT_DIR??'docs/screenshots';mkdirSync(evidenceDir,{recursive:true});
import {chromium} from '@playwright/test';
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto('http://localhost:3000/operations');await page.getByLabel('Operations access token').fill(process.env.ADMIN_TOKEN);await page.getByRole('button',{name:'Open operations'}).click();await page.getByRole('heading',{name:'Needs a human.'}).waitFor();await page.screenshot({path:evidenceDir+'/operations-desktop.png',fullPage:true});
await page.getByRole('tab',{name:/Evaluation Lab/}).click();await page.getByRole('heading',{name:'Evaluation Lab',exact:true}).waitFor();await page.screenshot({path:evidenceDir+'/evaluation-current.png',fullPage:true});
await page.setViewportSize({width:390,height:844});await page.screenshot({path:evidenceDir+'/operations-mobile.png',fullPage:false});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error('Operations overflow');
await page.setViewportSize({width:1440,height:1000});await page.goto('http://localhost:3000/case-study');await page.getByText('Latest recorded run').waitFor();await page.screenshot({path:evidenceDir+'/case-study-desktop.png',fullPage:true});
console.log(JSON.stringify({productionBrowserErrors:errors}));if(errors.length)process.exitCode=1;await browser.close();
