   
//***************************************************************/
// 
// จับข้อมูล dataDevices มาใส่ global ทุก1นาที
// - เพื่อให้การอ่านข้อมูล device เป็นไปอย่างรวดเร็ว เพราะต้องใช้กับ trigger alert ตอนรับข้อมูลจาก esp32
// 
import schedule from 'node-schedule';
import { MongoClient } from 'mongodb'
// const myDateTime = await import(`../${mymoduleFolder}/myDateTime.js`)
global.DATA_DEVICES = [] ; // เก็บข้อมูลอุปกรณ์ทั้งหมดที่อ่านมา

// ทุก 30 วินาที
schedule.scheduleJob(`*/${global.LOOP_TIME_DATA_DEVICES} * * * * *`,  async () => {
  await read_dataDevices();
});


async function read_dataDevices() {
  const client = new MongoClient(global.dbUrl)
  await client.connect();
  try {
    // const timestamp = myDateTime.now()
    const db = client.db(dbName)
    const coll_devices = db.collection(global.dbColl_devices)
    //=== จับข้อมูลอุปกรณ์ทั้งหมด
    const dataDevices = await coll_devices.find(
      {},
      { projection: { 
          _id:0, 
          changesHistory:0 ,
          dateTimeCanDelete:0,
          deviceBgClassColor:0,
        } 
      }
    ).toArray()
    global.DATA_DEVICES = dataDevices
    // console.log(global.DATA_DEVICES);
  } catch (err) {
    console.log('Error in read_dataDevices:', err.message);
  } finally {
    await client.close();
  }
}

// อ่านข้อมูลอุปกรณ์ตอนเริ่มระบบครั้งแรก
await read_dataDevices();














