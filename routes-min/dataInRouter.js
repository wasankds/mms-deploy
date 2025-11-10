// import { DateTime } from 'luxon'
// import multer from 'multer'
// import path from 'path'
// import fs from 'fs'
// import * as myUsers from "../mymodule/myUsers.js"
// import * as myModule from "../mymodule/myModule.js"
// import mainAuth from "../middleware/mainAuth.js" 
// import * as myDateTime from "../mymodule/myDateTime.js"
// const PATH_MAIN = '/user'
// const PATH_SAVE = `${PATH_MAIN}/save`
// const PATH_CHANGE_PASSWORD = `${PATH_MAIN}/change-password`  
// const PATH_UPLOAD = `${PATH_MAIN}/upload`
// const SIGNATURE_SUFFIX = "_SIGNATURE"
import express from 'express'
const router = express.Router()
import { MongoClient } from 'mongodb'
const myDateTime = await import(`../${mymoduleFolder}/myDateTime.js`)
const mySendMessage = await import(`../${mymoduleFolder}/mySendMessage.js`)

//=======================================================
// 
// *** สำหรับรับข้อมูลจาก esp32 ***
// 
// รับ path ที่ขึ้นต้นด้วย e เช่น /e001, /e002
// - เช่น http://localhost/e005?h=75&t=35&key=7127000
//       http://localhost:80/e001
// 
//       https://mms.wasankds.com/e001
// 
router.post(/^\/e\d{3}$/, async (req, res) => {
  console.log(`-----------------${req.path}----------------------`)
  console.log("req.body ===> " , req.body)
  // req.body ===>  { t: 34.2, h: 66, id: 'e001', key: '7127000' }
  
  const { id } = req.body
  const client = new MongoClient(global.dbUrl)

  try{

    //=== 1.) ตรวจสอบ key
    if(!global.SYS_KEYS.includes(req.body.key)){
      return res.status(403).send({ status : 'error', msg: 'Forbidden' });
    }
    delete req.body.key

    //=== 2.) แปลง req.body ให้เป็นตัวเลข
    // - กรองเอาคีย์ id ออก เพราะไม่ต้องแปลงชนิดข้อมูล
    // - คีย์อื่นๆแปลงชนิดข้อมูลเป็น Number ถ้ารูปแบบมาเป็นตัวเลข
    const data = Object.entries(req.body)
      .filter(([key]) => key !== 'id' && key.length == 1)
      .map(([key, value]) => ({
        id: req.body.id,
        key,
        value: (!isNaN(value) && value !== '') ? Number(value) : value
      }));

    //=== 3.) ปรับ timeInterval ให้ลงตัวรอบ 10 นาที (เช่น 13:57 -> 13:50)
    const timestamp = myDateTime.now() // 'YYYY-MM-DD HH:mm:ss'
    const timeInterval = timestamp.substring(0, 15) + '0'; // ตัด SS ออก แล้วเติม 0 แทน
    const dateTime = timestamp.slice(0,16) // 'YYYY-MM-DD HH:mm' - สำหรับ alert 
    // // สำหรับทดสอบ
    // return res.status(200).json({ message: 'ok' });

    //=== เขียนลงฐานข้อมูล - ตารางชื่อเดียวกับ id เช่น e001, e002
    await client.connect()
    const db = client.db(global.dbName)
    const collection = db.collection(id)

    //=== 4.) บันทึกหรืออัปเดทข้อมูลทีละ key 
    // - ดึงข้อมูลเอกสารเดิม (ถ้ามี) มาเปรียบเทียบแล้วอัปเดท (ถ้าไม่มี) ให้สร้างใหม่    
    // - เขียน1คีย์ลง1เอกสาร
    for (const { key, value } of data) {
      const filter = { key: key, timeInterval: timeInterval };    
      
      //== 4.1) ค้นหาเอกสารเดิมก่อน - ถ้ามีให้ update
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
      //== 4.2) ถ้าไม่มีเอกสารเดิม ให้ insert ใหม่
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
          rtn = newDoc; // }else{console.log('Insert not acknowledged or no insertedId');
        }
      }

      //== 4.3) ตรวจสอบ trigger alert
      // - find ใน global.DATA_DEVICES
      const deviceFind = global.DATA_DEVICES.find( dev => dev.deviceId === id )
      if(deviceFind && Array.isArray(deviceFind.triggerRows) && deviceFind.triggerRows.length > 0){
        
        //= 4.3.1) กรอง triggerRows ที่ตรงกับ key ที่ส่งมา - เพื่อเอาไปตรวจสอบ trigger min/max
        const triggerRow_byKey = deviceFind.triggerRows.filter( row => row.triggerKey === key )
        if(triggerRow_byKey.length > 0){

          //= 4.3.1-1) ตรวจสอบ min/max
          const triggerMin = triggerRow_byKey[0].triggerMin
          const triggerMax = triggerRow_byKey[0].triggerMax

          //= 4.3.1-2) ตรวจสอบเงื่อนไขการแจ้งเตือน
          let isAlert = false
          let triggerType = ''
          let triggerValue = null
          if (triggerMin && value < triggerMin) {
            isAlert = true;
            triggerType = 'min';
            triggerValue = triggerMin
          } else if (triggerMax && value > triggerMax) {
            isAlert = true;
            triggerType = 'max';
            triggerValue = triggerMax
          }

          //= 4.3.1-3) แจ้งเตือนจากครั้งที่แล้ว 1 นาที ขึ้นไป
          const coll_alerts = db.collection(global.dbColl_alerts)
          const lastAlert = await coll_alerts.findOne(
            { key: key, deviceId: id },  // ค้นหาจาก 2 คีย์นี้ - สร้าง index แล้ว
            { sort: { timestamp: -1 } }  // '2025-10-24 15:15:51'
          );
          if(lastAlert){
            const lastAlert_timestamp_min = lastAlert.timestamp.slice(0,16) // 'YYYY-MM-DD HH:mm'            
            if(lastAlert_timestamp_min === dateTime){
              isAlert = false // ยังไม่ถึงนาทีถัดไป ให้ยกเลิกการแจ้งเตือน
            }
          }

          //= 4.3.1-4) บันทึก alert ลงฐานข้อมูล และส่ง telegram (ถ้ามีการตั้งค่า)
          if(isAlert){
            const alertDoc = {
              deviceId: deviceFind.deviceId,
              deviceName: deviceFind.deviceName,
              timestamp: timestamp,
              key: key,
              keyName : global.KEYS_DEFINITION.find(k => k.key === key)?.keyName || '-',
              keyUnit : global.KEYS_DEFINITION.find(k => k.key === key)?.keyUnit || '-',
              triggerType: triggerType,
              triggerValue: triggerValue,
              value: value,
            }

            const alertResult = await coll_alerts.insertOne(alertDoc)
            if(alertResult.acknowledged && alertResult.insertedId){
              // console.log(`Alert inserted for deviceId: ${id}, key: ${key}, value: ${value}`);

              //= สร้างข้อความแจ้งเตือน
              const msgAlert = `⚠️ แจ้งเตือน [⏰ ${dateTime}]` +
                      `\n📍 ${deviceFind.deviceName} [${deviceFind.deviceId}]` +
                      `\n- ${alertDoc.keyName} [${key}] : ${triggerType == 'min' ? 'ต่ำเกินไป' : 'สูงเกินไป'}` +
                      `\n- ค่าปัจจุบัน : ${value} ${alertDoc.keyUnit}` +
                      `\n- ค่าแจ้งเตือน : ${triggerValue} ${alertDoc.keyUnit}`

              //= Boardcast ข้อมูล alert ไปยัง client ที่เชื่อมต่อผ่าน socket.io
              req.io.emit('alert', {
                ...alertDoc,
                _id: alertResult.insertedId.toString(),
                msg : msgAlert
              });


              //= จับสถานะการส่ง Telegram จาก device - deviceTelegramNotify / deviceTelegramGroupChatId
              const deviceTelegramNotify = deviceFind.deviceTelegramNotify
              const deviceTelegramGroupChatId = deviceFind.deviceTelegramGroupChatId
              if(deviceTelegramNotify === 'on' && deviceTelegramGroupChatId){
                //== ส่งข้อความแจ้งเตือนทาง Telegram
                const coll_settingsSystem = db.collection(global.dbColl_settingsSystem)
                const settingsSystem = await coll_settingsSystem.findOne()
                //== จับ botToken จาก settingsSystem
                if(settingsSystem && settingsSystem.TELEGRAM_BOT_TOKEN){
                  //= ส่งแจ้งเตือนทาง telegram (ถ้ามีการตั้งค่า) - ตรวบสอบว่าส่งหรือไม่
                  if(deviceFind.deviceTelegramNotify === 'on'){
                    await mySendMessage.sendMsgToGroup(msgAlert, settingsSystem.TELEGRAM_BOT_TOKEN, deviceTelegramGroupChatId);
                  }
                }
              }
              
            }            
          }

        }
      }

      //== 4.4) ส่งข้อมูลไปยัง client ที่เชื่อมต่อผ่าน socket.io
      rtn.lastValue = value      // ส่งค่าล่าสุด    ไปด้วย
      rtn.timestamp = timestamp  // ส่งเวลาปัจจุบัน ไปด้วย
      req.io.emit(id, rtn);
    } // for - end 
    
    //=== ส่งกลับไปที่ ESP32 ===
    return res.status(200).send({ status:'ok', msg:`I have got your data at ${timestamp}` });
  }catch(error){
    console.log(error)
    res.status(500).send({ status:'error', msg: error.message });
  }finally{
    await client.close()
  }
});

export default router

