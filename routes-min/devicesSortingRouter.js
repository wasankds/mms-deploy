/* import XLSX from "xlsx" */
// import ejs from 'ejs'
// import path from 'path'
// import fs from 'fs'
// import { DateTime } from 'luxon'
// import multer from 'multer'
// import sharp from 'sharp'
// import * as myData from "../mymodule/myData.js"
// import * as myUsers from "../mymodule/myUsers.js"
// import * as myModule from "../mymodule/myModule.js"
// const PREFIX = PATH_MAIN.replace(/\//g,"_") 
// const myData = await import(`../${mymoduleFolder}/myData.js`)
import express from 'express' ;
const router = express.Router() ; 
import { MongoClient } from 'mongodb'
import mainAuth from "../middleware/mainAuth.js"
const myDateTime = await import(`../${mymoduleFolder}/myDateTime.js`)
const myUsers = await import(`../${mymoduleFolder}/myUsers.js`)
const myModule = await import(`../${mymoduleFolder}/myModule.js`)
const PATH_MAIN = '/devices-sorting'
const PATH_SAVE = `${PATH_MAIN}/save`


//================================================================
// 
// 
router.get(PATH_MAIN, mainAuth.isAuth , async (req, res) => {
  const client = new MongoClient(global.dbUrl)
  try{
    await client.connect()
    const db = client.db(global.dbName)

    //=== 1.) จับชื่อ collections ที่ขึ้นต้นด้วย e ตามด้วยตัวเลข 3 ตัว
    // - นับจำนวนเอกสารในแต่ละ collection ที่กรองมา
    // - ถ้า Collection ไม่มี document ให้ลบ Collection นั้นทิ้ง
    const collName_of_devices = await db.listCollections().toArray()
    collName_of_devices.sort( (a, b) => a.name.localeCompare(b.name) ) 
    const filteredColls = collName_of_devices.map(coll => coll.name).filter(name => /^e\d{3}$/.test(name));
    for (const collName of filteredColls) {
      const count = await db.collection(collName).countDocuments();
      if (count === 0) {
        await db.collection(collName).drop();
        // หลัง drop() ลบชื่อ collection ออกจาก filteredColls
        const index = filteredColls.indexOf(collName);
        if (index > -1) {
          filteredColls.splice(index, 1);
        }
      }
    }

    const user = await myUsers.getSessionData(req)

    //=== 2.) เรียงตามอาเรย์ sortArrays ถ้ามีในอาเรย์นี้
    // - ดึง sortArrays จากฐานข้อมูล
    const coll_devicesSorting = db.collection(global.dbColl_deviceSorting)
    const devicesSortingByUserId = await coll_devicesSorting.findOne(
      { userId : user.userId  },
      { projection: { _id:0 } }
    )
    if(devicesSortingByUserId){
      const devicesSortingRows = devicesSortingByUserId.devicesSortingRows || []
      // - อะไรที่ไม่มีในอาเรย์ devicesSortingRows ให้เอาไว้ บนสุด
      filteredColls.sort( (a, b) => {
        const indexA = devicesSortingRows.indexOf(a);
        const indexB = devicesSortingRows.indexOf(b);
        if(indexA === -1 && indexB === -1) return 0;
        if(indexA === -1) return -1;
        if(indexB === -1) return 1;
        return indexA - indexB;
      });
      // // - อะไรที่ไม่มีในอาเรย์ devicesSortingRows ให้เอาไว้ล่างสุด
      // filteredColls.sort( (a, b) => {
      //   const indexA = devicesSortingRows.indexOf(a);
      //   const indexB = devicesSortingRows.indexOf(b);
      //   if(indexA === -1 && indexB === -1) return 0;
      //   if(indexA === -1) return 1;
      //   if(indexB === -1) return -1;
      //   return indexA - indexB;
      // });
    }
    
    //=== 3.) จับข้อมูลอุปกรณ์ทั้งหมด - สำหรับ Lookup ชื่ออุปกรณ์
    const coll_devices = db.collection(global.dbColl_devices)
    const devicesFind = await coll_devices.find(
      { }, 
      { projection: { 
          _id:0, 
          deviceId:1,
          deviceName:1,
          deviceBgClassColor:1
        } 
      }
    ).toArray()

    //=== 4.) จัดรูปแบบข้อมูลอุปกรณ์ใหม่ 
    // - ต้องใช้จาก filteredColls ที่ผ่านการจัดเรียงมาแล้ว
    const dataDevices = filteredColls.map( collName => {
      const deviceInfo = devicesFind.find( device => device.deviceId === collName )
      return {  
        deviceId: collName,
        deviceName: deviceInfo ? deviceInfo.deviceName : '-',
        deviceBgClassColor: deviceInfo ? deviceInfo.deviceBgClassColor : 'bg-gray',
      }
    })
    // console.log("dataDevices ===> ", dataDevices)

    //=== 5.) Render View
    const html = await myModule.renderView("devicesSorting", res, {
      title: PAGE_DEVICES_SORTING,
      time : myDateTime.getDate(),
      msg: req.flash('msg'),
      user, 
      
      data : dataDevices,
      PATH_MAIN,
      PATH_SAVE,
    })
    res.send(html)
  }catch(err){
    console.log(err)
    res.status(404).sendFile(file404)
  }finally{
    client.close()
  }

})


//=======================================================
// แยกยูสเซอร์
// 
router.post(PATH_SAVE, mainAuth.isAuth, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`)
  // console.log("req.body ===> " , req.body)

  const client = new MongoClient(global.dbUrl)
  try {

    const { deviceIdRows } = req.body
    const user = await myUsers.getSessionData(req)

    await client.connect()
    const db = client.db(global.dbName)
    const coll_deviceSorting = db.collection(global.dbColl_deviceSorting)

    //=== ข้อมูลที่บันทึกหรืออัปเดต
    const data = {
      userId: user.userId,
      devicesSortingRows: deviceIdRows,
    }

    //=== ค้นหาตาม userId ถ้ามีให้ทำการอัปเดต ถ้าไม่มีให้เพิ่มใหม่
    const rtnUpdate = await coll_deviceSorting.updateOne(
      { userId: user.userId },
      { $set: data },
      { upsert: true }
    )

    //== Return
    if (rtnUpdate.acknowledged && rtnUpdate.modifiedCount > 0) {
      res.send(JSON.stringify({
        isSave: true,
        class: "green",
        msg: `บันทึกข้อมูลเรียบร้อยแล้ว`,
      }))
    } else if (rtnUpdate.acknowledged && rtnUpdate.upsertedCount > 0) {
      res.send(JSON.stringify({
        isSave: true,
        class: "green",
        msg: `บันทึกข้อมูลเรียบร้อยแล้ว{{sep}}[เพิ่มใหม่]`,
      }))  
    } else if (rtnUpdate.acknowledged && rtnUpdate.modifiedCount ==  0 && rtnUpdate.upsertedCount == 0) {
      res.send(JSON.stringify({
        isSave: true,
        class: "yellow",
        msg: `ไม่มีการเปลี่ยนแปลง`,
      }))  
    } else {
      res.send(JSON.stringify({
        isSave: false,
        class: "red",
        msg: `ไม่สามารถบันทึกข้อมูลได้`,
      }))
    }
  } catch (err) {
    console.log("error ===> ", err);
    res.send(JSON.stringify({
      isSave: false,
      class: "red",
      msg: err.message,
    }))  
  } finally {
    client.close()
  }

})



export default router


