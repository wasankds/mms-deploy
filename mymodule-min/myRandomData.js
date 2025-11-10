
// เขียนหรืออัปเดทข้อมูลในฐานข้อมูล     
// - แยกข้อมูลตามตัวแปร data_t, data_h, data_i, data_v
// 
// - ถ้ามี record ที่ time ตรงกับรอบ 10 นาทีนี้แล้ว ให้ update
// - ถ้ายังไม่มี ให้ insert ใหม่
// - เช่น รอบ 10 นาที 09:00:00 - 09:09:59 ให้เก็บ timeInterval เป็น 09:00
// - รอบ 10 นาที 09:10:00 - 09:19:59 ให้เก็บ timeInterval เป็น 09:10

// และให้คำนวณค่า min max avg และ count(จำนวนครั้งที่มีการบันทึกค่า) ใหม่ด้วย
// - min max เอาค่าสูงสุด ต่ำสุดในรอบ 10 นาที
// - count คือจำนวนครั้งที่มีการบันทึกค่าในรอบ 10 นาที
// - avg = (avg * count + ค่าใหม่) / (count + 1)
// การเขียนค่าของ min, max, avg เช่นของ t ให้เขียน t_min, t_max, t_avg
// อย่าลืมว่าบางค่าอาจไม่มีการเขียนเข้ามา เช่น บางรอบไม่มีค่า t ก็อย่าไปอัปเดทค่า t_min, t_max, t_avg
    
// ***************************************************************/
import schedule from 'node-schedule';
import { DateTime } from 'luxon';
import * as MongoDB from 'mongodb';
const dbUrl = process.env.DB_URL

// ทุก 5 วินาที
schedule.scheduleJob('*/3 * * * * *',  async () => {

  // ทุก 1 นาที (ดอกจันไม่เท่ากันกับข้างบน)
  // schedule.scheduleJob('*/1 * * * *',  async () => {
  // if(global.IS_PRODUCTION) return - ใช้การปิดเปิดใน .env แทน

  await write_func('e001');
  await write_func('e002');
  await write_func('e003');
  // await write_func('e004');
  // await write_func('e005');
  // await write_func('e006');
  // await write_func('e007');
});


async function write_func(id) {
  const client = new MongoDB.MongoClient(dbUrl);  
  await client.connect();
  try {

    //=== จำลองข้อมูล
    // สุ่มค่า t, h, i, v
    const random_t = Math.floor(Math.random() * (45 - 25 + 1)) + 25;
    const random_h = Math.floor(Math.random() * (100 - 20 + 1)) + 20;
    const random_i = Math.floor(Math.random() * (200 - 150 + 1)) + 150;
    const random_v = Math.floor(Math.random() * (390 - 350 + 1)) + 350;    
    const random_d = Math.floor(Math.random() * (300 - 30 + 1)) + 30;    
    const random_g = Math.floor(Math.random() * (4000 - 500 + 1)) + 500;    
    // สุ่มว่าจะเขียนแต่ละค่าไหม
    const data1 = Math.random() < 0.5 ? { t: random_t } : null;
    const data2 = Math.random() < 0.5 ? { h: random_h } : null;
    const data3 = Math.random() < 0.5 ? { i: random_i } : null;
    const data4 = Math.random() < 0.5 ? { v: random_v } : null;
    const data5 = Math.random() < 0.5 ? { d: random_d } : null;
    const data6 = Math.random() < 0.5 ? { g: random_g } : null;
    // สร้าง keyDataArr โดยดูจาก data1-4 ที่ไม่เป็น null แล้วดึง key จริงจาก object
    const dataArr = [data1, data2, data3];
    // const dataArr = [data1, data2];
    //===
    const keyDataArr = dataArr.map( data => {
        if (!data) return null;
        const key = Object.keys(data)[0];
        return { key, value: data[key] };
      }).filter(Boolean);
    // console.log('keyDataArr ===> ' , keyDataArr);
    // [
    //   { key: 't', value: 41 },  // แต่อาจมาไม่ครบทุกตัว
    //   { key: 'h', value: 20 },
    //   { key: 'i', value: 184 }, 
    //   { key: 'v', value: 375 }
    // ]
    // ---- ข้างบนห้ามยุ่ง -----
    
    //=== 1.) ปรับ timeInterval ให้ลงตัวรอบ 10 นาที (เช่น 13:57 -> 13:50)
    const timestamp = DateTime.now().setZone('Asia/Bangkok').toFormat('yyyy-MM-dd HH:mm:ss');
    const timeInterval = timestamp.substring(0, 15) + '0';        
    const collName = id

    await client.connect()
    const db = client.db(global.dbName)
    const collection = db.collection(collName)   

    //=== 2.) วนลูป keyDataArr เพื่อ update หรือ insert ข้อมูล
    for (const { key, value } of keyDataArr) {
      const filter = { key: key, timeInterval: timeInterval };

      // 1.1) ค้นหาเอกสารเดิมก่อน - ถ้ามีให้ update
      const existingDoc = await collection.findOne(filter);
      if (existingDoc) {
        var rtn = await collection.findOneAndUpdate(
          filter,
          { $set: {
              max: Math.max(existingDoc.max, value),
              min: Math.min(existingDoc.min, value),
              avg: parseFloat(((existingDoc.avg * existingDoc.count + value) / (existingDoc.count + 1)).toFixed(2)),
            },
            $inc: { count: 1 },
          },
          // คืนค่าเอกสารหลังอัปเดท และ ไม่สร้างใหม่ถ้าไม่มี
          { returnDocument: 'after', upsert: false } 
        );        
      } 
      // 1.2) ถ้าไม่มีเอกสารเดิม ให้ insert ใหม่
      else {
        const newDoc = {
          id: id, 
          key: key, 
          timeInterval: timeInterval,
          min: value, 
          max: value, 
          avg: value, 
          count: 1,
        };
        const rtnInsert = await collection.insertOne(newDoc);
        if(rtnInsert.acknowledged && rtnInsert.insertedId){
          rtn = newDoc;
        }else{
          console.log('Insert not acknowledged or no insertedId');
        }
      }


      //=== Boardcast rtn ไป่ WebSocket ด้วย (ถ้ามีการเชื่อมต่อ)
      // console.log(`Rtn for ${key} at ${timeInterval}:`, rtn);
      rtn.lastValue = value      // ส่งค่าล่าสุด    ไปด้วย
      rtn.timestamp = timestamp  // ส่งเวลาปัจจุบัน ไปด้วย
      if (global.io) {
        global.io.emit(id, rtn);
      }

      // Rtn for i at 2025-09-11 16:50: {
      //   _id: new ObjectId('68c29b528af52d06d8fecd49'), 
      //   id: 'e004',
      //   key: 'i',
      //   timeInterval: '2025-09-11 16:50',
      //   min: 161,
      //   max: 178,
      //   avg: 173,
      //   count: 4
      // }
    }  // for

    // return res.status(200).send({ status : 'ok', msg: 'I have got your data'});
  } catch (err) {
    console.log(err.message);
  } finally {
    await client.close();
  }
}


// รอบแป๊บนึงให้จับ dbUrl มาให้ได้ก่อน
// แล้วค่อยทำงาน
// เพราะถ้า import mySchedule.js ไว้ข้างบนเลย dbUrl จะยัง undefined
// เพราะต้องรอให้ process.env อ่านค่า .env เสร็จก่อน
// จับ dbUrl ได้แล้วค่อยทำงานจริงๆ
setTimeout( async () => {
  await write_func('e001');
  await write_func('e002');
  await write_func('e003');
  await write_func('e004');
  // await write_func('e005');  
  // await write_func('e006');  
  // await write_func('e007');  
}, 100);














