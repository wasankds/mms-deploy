   
//***************************************************************/
// 
// จับข้อมูล dataDevices มาใส่ global ทุก1นาที
// - เพื่อให้การอ่านข้อมูล device เป็นไปอย่างรวดเร็ว เพราะต้องใช้กับ trigger alert ตอนรับข้อมูลจาก esp32
// 
import schedule from 'node-schedule';
import { MongoClient } from 'mongodb'
import { exec } from 'child_process' // สำหรับรันคำสั่ง Terminal
import path from 'path'
import fs from 'fs'
// const myDateTime = await import(`../${global.mymoduleFolder}/myDateTime.js`)
const myDateTime = await import(`./myDateTime.js`)

// ทดสอบที่เวลา 8:19 น. ของทุกวัน
// schedule.scheduleJob(`23 8 * * *`,  async () => {
// ตี2 ของทุกวัน 
schedule.scheduleJob(`0 2 * * *`,  async () => {
  await backDataBase();
});


async function backDataBase() {
  const client = new MongoClient(global.dbUrl)
  await client.connect();
  try {
    const dt = myDateTime.getDateTime().replace(/[: ]/g, '_');
    const backupDirName = `${global.dbName}_${dt}`;
    const backupDir = path.join(global.folderBackup, backupDirName);
    
    //=== ตรวจสอบว่าโฟลเดอร์ backup มีอยู่แล้วหรือไม่
    if (fs.existsSync(backupDir)) {
      console.log(`มีโฟลเดอร์แบ็คอัพชื่อ "${backupDirName}" อยู่แล้ว`);
      return res.redirect(path_redirect);
    }

    //=== รันคำสั่งจาก bash terminal
    const cmd = `mongodump --db ${global.dbName} --out "${backupDir}"`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.log(`Error during backup: ${error.message}`);
      }
      // console.log(`แบ็คอัพฐานข้อมูล "${global.dbName}" ไปยัง ${backupDir} สำเร็จ`);
    });
  } catch (err) {
    console.log('Error : ', err.message);
  } finally {
    await client.close();
  }
}
















