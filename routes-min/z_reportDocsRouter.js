
import express from 'express';
const router = express.Router();
import { MongoClient } from 'mongodb';
import ejs from 'ejs'
import path from 'path'
import fs from 'fs'
import { DateTime } from 'luxon' // import * as myDateTime from "../mymodule/myDateTime.js"
import * as myUsers from "../mymodule/myUsers.js"
import * as myModule from "../mymodule/myModule.js"
import * as myData from "../mymodule/myData.js"
import mainAuth from "../middleware/mainAuth.js"
const WAREHOUSE_IN = `/report${global.PATH_WAREHOUSE_IN}`
const WAREHOUSE_OUT = `/report${global.PATH_WAREHOUSE_OUT}`
const SALES = `/report${global.PATH_SALES}`
const PATH_DOC_ARR = [global.PATH_WAREHOUSE_IN, global.PATH_WAREHOUSE_OUT, global.PATH_SALES]
const PATH_MAIN_ARR = [WAREHOUSE_IN, WAREHOUSE_OUT, SALES]
const PATH_CONCLUDE_ARR = [`${WAREHOUSE_IN}/conclude`, `${WAREHOUSE_OUT}/conclude`, `${SALES}/conclude`]
const PATH_CALENDAR_ARR = [`${WAREHOUSE_IN}/calendar`, `${WAREHOUSE_OUT}/calendar`, `${SALES}/calendar`]
const PATH_LOAD_ARR = [ `${WAREHOUSE_IN}/load`, `${WAREHOUSE_OUT}/load`, `${SALES}/load`]
const docStatus_agg = {
  docStatus: {
    $switch: {
      branches: [
        { case: { $eq: ["$docStatusNumber", 1] }, then: 'สร้าง' },
        { case: { $eq: ["$docStatusNumber", 2] }, then: 'จบ' },
        { case: { $eq: ["$docStatusNumber", 10] }, then: 'ยกเลิก' },
      ],
      default: 'Unknown'
    }
  },
  docStatusColor: {
    $switch: {
      branches: [
        { case: { $eq: ["$docStatusNumber", 1] }, then: 'fc-dodgerblue' },
        { case: { $eq: ["$docStatusNumber", 2] }, then: 'fc-green' },
        { case: { $eq: ["$docStatusNumber", 10] }, then: 'fc-orange' },
      ],
      default: 'fc-red'
    }
  },
  docStatusBgColor: {
    $switch: {
      branches: [
        { case: { $eq: ["$docStatusNumber", 1] }, then: 'bg-dodgerblue' },
        { case: { $eq: ["$docStatusNumber", 2] }, then: 'bg-green' },
        { case: { $eq: ["$docStatusNumber", 10] }, then: 'bg-orange' },
      ],
      default: 'bg-red'
    }
  },
}




//================================================================
// ดูข้อมูลได้ทุกคน แม้จะไม่ใช่คนสร้างก็ตาม ***
// เพราะไม่มีการแก้ไขข้อมูล
// 
router.get(PATH_MAIN_ARR, mainAuth.isAuth, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`) 
  // console.log(req.query)

  const user = await myUsers.getUserData(req)
  const { docTitle, collectionName, docType } = myData.get_Info_ByUrl(req.originalUrl)
  if(docType === 'warehouseIn'){
    var arrIndex = 0
  }else if(docType === 'warehouseOut'){
    var arrIndex = 1
  }else if(docType === 'sales'){
    var arrIndex = 2
  }
  var viewname = 'reportDocs.ejs'

  try{
    //=== 1.) จับข้อมูล ยูสเซอร์/สาขา
    if(user.userAuthority == 'A'){ // เฉพาะในสาขาของตนเอง 
      var dataUsers = await myData.getUsers_for_report({branchId: user.branchId })
      var dataBranches = await myData.getUserBranches({branchId: user.branchId})
    }else if(user.userAuthority == 'U'){ // เฉพาะของตนเอง
      var dataUsers = [] // ส่งค่าว่างไป
      var dataBranches = [] // ส่งค่าว่างไป
    }else{
      var dataUsers = await myData.getUsers_for_report({})
      var dataBranches = await myData.getUserBranches({})
    }    

    //=== จับเดือนที่มีเอกสาร
    const monthDocs = await myData.getDocs_MonthUnique(collectionName)
    // const dataDocConclude = await myData.getDocs_Conclude(collectionName)


    //=== 2.) Render EJS
    const html = await myModule.renderView(viewname, res, {
      title : docTitle ,
      time: DateTime.now().setZone('Asia/Bangkok').toFormat('yyyy-MM-dd'),
      msg: req.flash('msg'),
      user : user , 
      ...await myModule.getSettings(),

      PATH_MAIN : PATH_MAIN_ARR[arrIndex] ,
      PATH_DOC : PATH_DOC_ARR[arrIndex] ,
      PATH_CALENDAR : PATH_CALENDAR_ARR[arrIndex] ,
      PATH_CONCLUDE : PATH_CONCLUDE_ARR[arrIndex] ,
      // PATH_REPORT_ITEMS1 : PATH_REPORT_ITEMS1_ARR[arrIndex] ,
      // PATH_REPORT_ITEMS2 : PATH_REPORT_ITEMS2_ARR[arrIndex] ,
      PATH_LOAD : PATH_LOAD_ARR[arrIndex] ,

      // dataItemsJson : JSON.stringify(dataItems) ,
      dataUsersJson : JSON.stringify(dataUsers),
      dataBranchesJson : JSON.stringify(dataBranches) ,
      monthDocs: monthDocs, 
      dataDocConclude : JSON.stringify([]) , // JSON.stringify(dataDocConclude) ,
    })
    res.send(html)
  }catch(err){
    console.log(err)
    res.status(404).sendFile(file404)
    // }finally{ client.close()
  }
})


//================================================================
//
// 
router.post(PATH_CALENDAR_ARR, mainAuth.isAuth, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`) 
  // console.log("req.body ===> " , req.body)
  
  //==== ใช้ในการกรองข้อมูล
  let {  
    selectMonth, 
    userId,   searchUser,
    branchId, searchBranch,
  } = req.body
  userId = userId ?  Number(userId) : userId
  branchId = branchId ?  Number(branchId) : branchId

  // ดูได้เฉพาะในสาขาของตนเอง หรือ เฉพาะของตนเอง
  const user = await myUsers.getUserData(req)
  if(user.userAuthority == 'A'){ 
    branchId = user.branchId // ตัวเลข
    searchBranch = !searchBranch ? user.branchName : searchBranch
  }else if(user.userAuthority == 'U'){ 
    userId = user.userId // ตัวเลข
    searchUser = !searchUser ? user.userFullname : searchUser
    branchId = !branchId ? user.branchId : branchId
    searchBranch = !searchBranch ? user.branchName : searchBranch
  }
  // console.log("userId ===> " , userId)
  // console.log("searchUser ===> " , searchUser)
  // console.log("branchId ===> " , branchId)
  // console.log("searchBranch ===> " , searchBranch)


  const [year, month] = selectMonth.split("-");
  const formattedMonth = `${global.MONTH_NAMES[parseInt(month) - 1]} ${year}`;

  //=== 0.) จับชื่อคอเล็กชั่นจาก docTitle ที่ส่งมา
  const {collectionName} = myData.get_Info_ByUrl(req.originalUrl)
  if(!collectionName){
    return res.send(JSON.stringify({
      isLoad: false,
      class: "red",
      msg: "ไม่พบชื่อคอเล็กชั่น"
    }));
  }
  
  //=== เพิ่ม title ตามเงื่อนไขที่ส่งมา
  let title = `${formattedMonth}`
  if(userId){ title += `, [${userId}] ${searchUser}` }
  if(branchId){ title += `, [${branchId}] ${searchBranch}` }
  // if(itemId){ title += `, (${itemId}) ${searchItem}` }
  // if(docId){ title += `, ${docId}` }

  const client = new MongoClient(global.dbUrl);
  try{
    await client.connect()
    const db = client.db(global.dbName)
    const coll_docs = db.collection(collectionName)

    //=== 1.) สร้าง aggregate สำหรับรายงานปฏิทิน
    const agg = [
      // { $match: { docDate: { $regex: `^${selectMonth}` } }  }, // จับเดือน
      // จับเดือน
      {
        $project: {
          _id : 0, 
          docId : 1 ,
          docStatusNumber : 1 ,
          docDate : { $substr: [ "$docDateTime", 0, 10 ] },
          docDateTime : 1 ,
          totalAmount : { $ifNull: [ "$totalAmount", 0 ] },
          userId : 1 ,
          userFullname : 1 ,
          branchId : 1 ,
          branchName : 1 ,
          tableRows : 1 ,
          ...docStatus_agg ,
        }
      }
    ]

    //=== 2.) กรอง 
    if(userId){ agg.unshift({ $match: { userId: userId } }) }
    if(branchId){ agg.unshift({ $match: { branchId: branchId } }) }
    // if(itemId){ agg.unshift({ $match: { "tableRows.itemId": itemId } }) }
    // if(docId){ agg.unshift({ $match: { docId: docId } }) }
    const dataDocs = await coll_docs.aggregate(agg).toArray()
    title += ` [${dataDocs.length}]`
    
    if(dataDocs.length > 0){
      dataDocs.forEach( doc => {
        console.log(doc.totalAmount)
      })
    }

    //=== 3.)  ส่งไปสร้างปฏิทินด้วย JavaScript
    res.send(JSON.stringify({
      isLoad:true,
      class:"green", 
      title:title,
      dataDocs:dataDocs,
      selectMonth:selectMonth,
      msg:"โหลดข้อมูลเรียบร้อยแล้ว",
    }))
  }catch(err){
    console.log(err)
    res.send(JSON.stringify({ 
      isLoad:false, 
      class:"red", 
      title:title,
      selectMonth:selectMonth,
      msg:err.message,
    }))
  }finally{
    client.close()
  }
})




//================================================================
// 
// 
router.post(PATH_CONCLUDE_ARR, mainAuth.isAuth, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`) 
  // console.log("req.body ===> " , req.body)

  //=== รับค่าต่างๆ จาก body
  let { 
    selectMonth, selectMonthTh, 
    selectDateTh , selectDate,
    userId, searchUser ,
    branchId, searchBranch
  } = req.body
  userId = userId ?  Number(userId) : userId
  branchId = branchId ?  Number(branchId) : branchId
  
  const user = await myUsers.getUserData(req)
  if(user.userAuthority == 'A'){ 
    branchId = user.branchId // ตัวเลข
    searchBranch = !searchBranch ? user.branchName : searchBranch
  }else if(user.userAuthority == 'U'){ 
    userId = user.userId // ตัวเลข
    searchUser = !searchUser ? user.userFullname : searchUser
    branchId = !branchId ? user.branchId : branchId
    searchBranch = !searchBranch ? user.branchName : searchBranch
  }

  //=== 0.) จับชื่อคอเล็กชั่นจาก docTitle
  // const { docType } = myData.get_Info_ByUrl(req.originalUrl)
  // //=== 0.3) จับชื่อฐานข้อมูล
  const {collectionName} = myData.get_Info_ByUrl(req.originalUrl)
  if(!collectionName){
    return res.send(JSON.stringify({
      isLoad: false,
      class: "red",
      msg: "ไม่พบชื่อคอเล็กชั่น"
    }));
  }

  //=== สร้าง title สำหรับรายงาน
  if(selectMonth && selectMonthTh){
    var titleConclude = `สรุปเอกสารเดือน`
    var title = `${selectMonthTh}`
    var titleClassColor = 'bg-cornblue'
    var matchedCount = { $regex: `^${selectMonth}` }
  }else if(selectDate && selectDateTh){
    var titleConclude = `สรุปเอกสารวันที่`
    var title = `${selectDateTh}`
    var titleClassColor = 'bg-deepskyblue'
    var matchedCount = { $regex: `^${selectDate}` }
  }
  if(userId){ title += `, [${userId}] ${searchUser}` }
  if(branchId){ title += `, [${branchId}] ${searchBranch}` }

  const client = new MongoClient(global.dbUrl);
  try{
    await client.connect()
    const db = client.db(global.dbName)
    const coll_docs = db.collection(collectionName)

    //=== 1.) docsReport - รายงานเอกสาร
    const agg = [
      // { $match: { docDate: { $regex: `^${selectMonth}` } } },
      // { $match: { docDate: matchedCount } },
      { $match: { docDateTime: matchedCount } },
      { $project: {
          _id: 0,
          docId : 1 ,                         
          docDateTime : 1 ,   
          // // ตัดเอาแค่ 10 ตัวแรก (yyyy-mm-dd)
          // docDate : { $substr: [ "$docDateTime", 0, 10 ] },
          docStatusNumber : 1 ,     
          totalAmount : 1 ,          
          userId : 1 ,          
          userFullname : 1 ,
          branchId : 1 ,
          branchName : 1 ,
          // "tableRows": 0          
          ...docStatus_agg ,
        }
      }
    ]
    //== 1.2) เพิ่ม match ใน aggregate กรณีมีคำค้นหา เพื่อกรองข้อมูล
    if(userId){ agg.unshift({ $match: { userId: userId } }) }
    if(branchId){ agg.unshift({ $match: { branchId: branchId } })  }
    // if(itemId){ agg.unshift({ $match: { "tableRows.itemId": itemId } }) }
    const dataDocs = await coll_docs.aggregate(agg).toArray()

    //== 1.4) สร้างฟอร์มจาก HTML
    const templatePath = path.join(folderForms, 'reportConcludeDocs.ejs')
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    var htmlDiv = ejs.render(templateContent, {
      titleConclude ,
      title,
      titleClassColor, 
      data : dataDocs,
    })


    return res.send(JSON.stringify({
      isLoad:true, 
      class:"green", 
      htmlDiv:htmlDiv
    }))
  }catch(err){
    console.log(err)
    res.send(JSON.stringify({ 
      isLoad:false, 
      class:"red", 
      msg:err.message
    }))
  }finally{
    client.close()
  }
})




//=============================================
//
//
router.post(PATH_LOAD_ARR, mainAuth.isAuth, async (req, res) => {  
  // console.log(`-----------------${req.originalUrl}------------------`) 
  // console.log(req.body)

  //=== 0.1) จับค่าจาก request body
  let { docId } = req.body 

  //=== 0.2) จับชื่อฐานข้อมูล
  const {collectionName, docType } = myData.get_Info_ByUrl(req.originalUrl)
  if(docType === 'warehouseIn'){
    var arrIndex = 0
  }else if(docType === 'warehouseOut'){
    var arrIndex = 1
  }else if(docType === 'sales'){
    var arrIndex = 2
  }
  // //           <!-- <a href="<= global.DOMAIN_ALLOW ><= pathClick >?docId=<= doc.docId >" target="_blank">
  //           <span class="<%= doc.docStatusColor %>"><%= doc.docId %></span>
  //         </a> -->
  if(!collectionName){
    return res.send(JSON.stringify({
      isLoad: false,
      class: "red",
      msg: "ไม่พบชื่อคอเล็กชั่น"
    }));
  }

  const user = await myUsers.getUserData(req)
  if(user.userAuthority == 'A'){ // เฉพาะในสาขาของตนเอง
    var matchConditions = { docId: docId, branchId: user.branchId }
  } else if(user.userAuthority == 'U'){ // เฉพาะของตนเอง
    var matchConditions = { docId: docId, userId: user.userId }
  } else {
    var matchConditions = { docId: docId }
  }

  const client = new MongoClient(global.dbUrl)
  try{
    await client.connect()
    const db = client.db(global.dbName)
    const collection = db.collection(collectionName)

    // var docFind = await collection.findOne( 
    //   matchConditions ,
    //   { projection: { _id:0, changesHistory:0 }  }
    // )
    const agg = [
      { $match: matchConditions },
      { $project: {
          _id: 0,
          docId : 1 ,
          // docDate : 1 ,             
          // docDateTh : 1 ,             
          docDateTime : 1 ,
          docStatusNumber : 1 ,     
          totalAmount : { $ifNull: [ "$totalAmount", null ] }, // ถ้าไม่มี totalAmount ให้เป็น null
          userId : 1 ,          
          userFullname : 1 ,    
          branchId : 1 ,            
          branchName : 1 ,
          tableRows : 1 ,
          ...docStatus_agg ,
        }
      }
    ]
    const docFind = await collection.aggregate(agg).toArray()
    if(docFind.length === 0){
      return res.send(JSON.stringify({
        isLoad: false ,
        class:"red", 
        msg: `ไม่พบเอกสารเลขที่ "${docId}"`
      }))
    }
    let doc = docFind[0]
    doc = myData.convert_DocPrint(doc)
    doc.totalAmount = Number(doc.totalAmount) == 0 ? null : doc.totalAmount

    //== 1.4) สร้างฟอร์มจาก HTML
    const templatePath = path.join(folderForms, 'reportByDocId.ejs')
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const htmlDiv = ejs.render(templateContent, {
      title : docId,
      doc : doc,
      PATH_DOC : PATH_DOC_ARR[arrIndex],
    })
    return res.send(JSON.stringify({
      isLoad:true, 
      class:"green", 
      htmlDiv:htmlDiv
    }))
  }catch(err){
    console.log(err)
    return res.send(JSON.stringify({
      isLoad: false ,
      class:"red", 
      msg:err.message
    }))
  }finally{
    client.close()
  }
})





export default router






/* 


ตัวอย่างข้อมูลใน ผลลัพทธ์ dbColl_warehouseIn
เนื่องจาก itemsInSet ที่เป็นผลลัพธ์ อาจมี  itemPackageType เป็น 'set' หรือ 'single' ก็ได้
ดังนั้นเราจึงต้องมีการตรวจสอบ itemsInSet ใน dbColl_items อีกที

{
  "docId": "WI2509-00004",
  "docStatusNumber": 1,
  "branchId": 100,
  "userId": 1000,
  "totalAmount": 1065,
  "docDate": "2025-09-08",
  "tableRows": [
    {
      "itemId": "SUGAR-01-BOX",
      "description": "น้ำตาล(กล่อง)",
      "unit": "ซอง",
      "price": 55,
      "quantity": 3,
      "amount": 165,
      "itemPackageType": "set",
      "itemsInSet": [
        {
          "itemId": "SUGAR-01-SACHET",
          "itemAmount": 12,
          "itemName": "น้ำตาล(ซอง)",
          "itemPackageType": "single"
        }
      ],
      "itemQuantity_total": 36
    },
    {
      "itemId": "SUGAR-01-CRATE",
      "description": "น้ำตาล(ลัง)",
      "unit": "ซอง",
      "price": 450,
      "quantity": 2,
      "amount": 900,
      "itemPackageType": "set",
      "itemsInSet": [
        {
          "itemId": "SUGAR-01-BOX", 
          "itemAmount": 20,
          "itemName": "น้ำตาล(กล่อง)",
          "itemPackageType": "set"   // ต้องตรวจสอบ itemsInSet อีกที
        }
      ],
      "itemQuantity_total": 40
    }
  ]
}


ผลลัพธ์ที่ต้องการได้ itemsInSet ต้องถูกแตกเป็น itemPackageType 'single' ให้หมด
เช่น 




{
  "docId": "WI2509-00004",
  "docStatusNumber": 1,
  "branchId": 100,
  "userId": 1000,
  "totalAmount": 1065,
  "docDate": "2025-09-08",
  "tableRows": [
    {
      "itemId": "SUGAR-01-BOX",
      "description": "น้ำตาล(กล่อง)",
      "unit": "ซอง",
      "price": 55,
      "quantity": 3,
      "amount": 165,
      "itemPackageType": "set",
      "itemsInSet": [
        {
          "itemId": "SUGAR-01-SACHET",
          "itemAmount": 12,
          "itemName": "น้ำตาล(ซอง)",
          "itemPackageType": "single"
        }
      ],
      "itemQuantity_total": 36
    },
    {
      "itemId": "SUGAR-01-CRATE",
      "description": "น้ำตาล(ลัง)",
      "unit": "ซอง",
      "price": 450,
      "quantity": 2,
      "amount": 900,
      "itemPackageType": "set",
      // เดิม
      // "itemsInSet": [
      //   {
      //     "itemId": "SUGAR-01-BOX", 
      //     "itemAmount": 20,
      //     "itemName": "น้ำตาล(กล่อง)",
      //     "itemPackageType": "set"   // ต้องตรวจสอบ itemsInSet อีกที
      //   }
      // ],
      "itemsInSet": [
        {
          "itemId": "SUGAR-01-SACHET", 
        }
      ],

      "itemQuantity_total": 40*12 = 480
    }
  ]
}





ตัวอย่างข้อมูลใน dbColl_items ที่มี 3 ชั้น ที่ต้องตรวจสอบ
{
  "itemId": "SUGAR-01-SACHET",
  "itemPackageType": "single",
  "itemStock": "1",
  "categoryId": 103,
  "itemStatus": "active",
  "itemName": "น้ำตาล(ซอง)",
  "itemPrice": 3,
  "itemUnit": "ซอง",
  "itemsInSet": [],
},
{
  "itemId": "SUGAR-01-BOX",
  "itemPackageType": "set",
  "itemStock": "1",
  "categoryId": 103,
  "itemStatus": "active",
  "itemName": "น้ำตาล(กล่อง)",
  "itemPrice": 30,
  "itemUnit": "ซอง",
  "itemsInSet": [{ "itemId": "SUGAR-01-SACHET", "itemAmount": 12 }],
},
{
  "itemId": "SUGAR-01-CRATE",
  "itemPackageType": "set",
  "itemStock": "1",
  "categoryId": 103,
  "itemStatus": "active",
  "itemName": "น้ำตาล(ลัง)",
  "itemPrice": 550,
  "itemUnit": "ซอง",
  "itemsInSet": [ { "itemId": "SUGAR-01-BOX", "itemAmount": 20 } ],
}


*/






// // วนลูปเอกสารแต่ละตัว
// const dataDocsProcessed = dataDocs.map( doc => ({
//   ...doc,
//   tableRows: doc.tableRows.map(row => {
//     const item = itemsMap.get(row.itemId);
//     // 1.) ถ้าไม่เจอ item ข้ามไป
//     if (!item) return row; 

//     // 2.1) single: ไม่มี itemsInSet
//     if (item.itemPackageType === 'single') {
//       return {
//         ...row,
//         itemPackageType: 'single',
//         itemQuantity_total: row.quantity,
//       };
//     } 
//     // 2.2) set: ต้องแตก itemsInSet
//     else if (item.itemPackageType === 'set') {
//       const itemsInSet = (item.itemsInSet || []).map(setItem => ({
//         ...setItem, // มีแต่ itemId กับ itemAmount
//         itemName: itemsMap.get(setItem.itemId)?.itemName || 'ไม่พบข้อมูล', // เพิ่มชื่อไอเท็ม
//         itemPackageType: itemsMap.get(setItem.itemId)?.itemPackageType || 'ไม่พบข้อมูล',
//       }));
//       // คำนวณจำนวนรวม
//       const itemQuantity_total = itemsInSet.reduce(
//         (sum, setItem) => sum + (setItem.itemAmount * row.quantity), 0
//       );
//       return {
//         ...row,
//         itemPackageType: 'set',
//         itemsInSet,
//         itemQuantity_total,
//       };
//     } else {
//       return row;
//     }
//   })
// }));






/* 

เมื่อฉันจับข้อมูลจาก dbColl_warehouseIn ได้มาเป็น array ของเอกสารทั้งหมด (ตัวอย่างข้อมูลตามด้านล่าง)

จุดประสงค์ที่ฉันต้องการคือ การนับจำนวน item แต่ item มีทั้งแบบ single และ set
ซึ่งถ้าเป็น single ก็ง่ายหน่อย แต่ถ้าเป็น set ฉันต้องแตกไอเท็มใน set ออกมาอีกที


ฉันจะวนลูปเอกสารแต่ละตัว แล้วตรวจสอบรายการใน tableRows
โดยใช้ tableRows.itemId ไปค้นหาข้อมูลจาก dbColl_items ตรวจสอบ itemId ที่ตรงกัน

ให้สร้างข้อมูลใหม่ เพื่อแตกรายละเอียดไอเท็มใน tableRows

ที่ dbColl_items ถ้า itemPackageType = 'sigle' 
จับ itemId และ quantity จาก tableRows มาใส่ในข้อมูลใหม่ได้เลย

ที่ dbColl_items ถ้า itemPackageType = 'set' 
ให้ตรวจสอบ itemsInSet ว่ามี itemId อะไรบ้าง ซึ่งต้องตรวจสอบใน dbColl_items อีกที

คุณสามารถใช้ คำสั่ง MongoDB หรือ Node.js ในการช่วยจัดการข้อมูลก็ได้  เพื่อให้ได้ผลลัพธ์ที่ต้องการ
ตัวอย่างโครงสร้างข้อมูลที่ต้องการได้ดังนี้
{
  docId: "WI2509-00003",
  "tableRows": [
    { 
      "itemId": "8851759911626", "unit": "กล่อง", "quantity": 2, 
      "itemsInSet": [
        { "itemId": "8851759911619", "itemAmount": 12},
      ],
      "itemQuantity_total": 24,  // 2 * 12
    },
    .....
  ],
}

ตัวอย่างข้อมูลใน dbColl_warehouseIn
{
  "docId": "WI2509-00003",
  "docStatusNumber": 1,
  "branchId": 100,
  "userId": 1000,
  "totalAmount": 1992,
  "docDate": "2025-09-08",
  "tableRows": [
    { "itemId": "8851759911626", "unit": "กล่อง", "quantity": 2, },
    { "itemId": "8851759450460", "unit": "กล่อง", "quantity": 2, },
    { "itemId": "8851759911619", "unit": "ซอง", "quantity": 1, },
    { "itemId": "8851759450453", "unit": "ซอง", "quantity": 2, },
    { "itemId": "8851759911121", "unit": "ซอง", "quantity": 3, }
  ],
  "dateTimeCanEdit": "2025-09-08 17:23",
  "dateTimeCanCancel": "2025-09-09 01:23"
}


ตัวอย่างข้อมูลใน dbColl_items 
{
  "itemId": "8851759911619",
  "itemPackageType": "single",
  "itemOnSale": "1",
  "categoryId": 100,
  "itemStatus": "active",
  "itemName": "เจอร์ไฮ ชิคเก้น เจอร์กี้ (50กรัม)",
  "itemPrice": 45,
  "itemUnit": "ซอง",
  "itemRegisterDate": "2025-08-31",
  "itemRegisterDateTh": "31 สิงหาคม 2568",
  "itemDesc": "เจอร์ไฮ  ชิคเก้น  เจอร์กี้  ซอง 50กรัม",
  "itemsInSet": [],
  "dateTimeCanDelete": "2025-09-01 15:45",
  "itemImage": "8851759911619.jpg",
  "itemStock": "1"
} ,
{
  "itemId": "8851759911626",
  "itemPackageType": "set",
  "categoryId": 100,
  "itemStatus": "active",
  "itemOnSale": "1",
  "itemName": "12เจอร์ไฮ ชิคเก้น เจอร์กี้ (50กรัม)",
  "itemPrice": 425,
  "itemUnit": "กล่อง",
  "itemRegisterDate": "2025-08-31",
  "itemRegisterDateTh": "31 สิงหาคม 2568",
  "itemDesc": "12เจอร์ไฮ  ชิคเก้น  เจอร์กี้ (50กรัม) จำนวน 12แพ็ค",
  "itemsInSet": [ { "itemId": "8851759911619", "itemAmount": 12 } ],
  "dateTimeCanDelete": "2025-09-01 15:17",
  "itemImage": "8851759911626.jpg",
  "itemStock": "1"
}
  
*/






/* 

//================================================================
// สร้างรายงานทั้งหมด 3 ชุด แบบเรียงลำดับ
// 
router.get('/path-1', async (req, res) => {
  console.log(`-----------------/path-1------------------`)

  try{ 
    // หน่วงเวลา เพื่อทดสอบ 3 วินาที
    await new Promise(resolve => setTimeout(resolve, 500));

    return res.send(JSON.stringify({
      isCreate:true, 
      class:"green", 
      msg: "สร้างรายงานขั้นที่ 1/3{{sep}}เรียบร้อยแล้ว"
    }))
  } catch(err){
    console.log(err)
    return res.send(JSON.stringify({
      isCreate:false, 
      class:"red", 
      msg: err.message
    }))
  }
}) 
  
*/



// router.get('/path-3', async (req, res) => {
//   console.log(`-----------------/path-3------------------`)
//   try{ 
//     // หน่วงเวลา เพื่อทดสอบ 3 วินาที
//     await new Promise(resolve => setTimeout(resolve, 3000));

//     return res.send(JSON.stringify({
//       isCreate:true,
//       class:"green",
//       msg:"สร้างรายงานขั้นที่ 3/3{{sep}}เรียบร้อยแล้ว"
//     }))
//   } catch(err){
//     console.log(err)
//     return res.send(JSON.stringify({
//       isCreate:false, 
//       class:"red", 
//       msg: err.message
//     }))
//   }
// })














// //================================================================
// // สร้างรายงานทั้งหมด 3 ชุด แบบเรียงลำดับ
// // 
// router.get(PATH_REPORT_ITEMS1_ARR, mainAuth.isAuth, async (req, res) => {
//   // console.log(`-----------------${req.originalUrl}------------------`)

//   //=== 0.) จับชื่อคอเล็กชั่นจาก URL
//   const { collectionName, docType } = myData.get_Info_ByUrl(req.originalUrl)
//   if(docType === 'warehouseIn'){
//     var collection_setData = global.dbColl_report_warehouseIn_item1 // เขียน
//   }else if(docType === 'warehouseOut'){
//     var collection_setData = global.dbColl_report_warehouseOut_item1 // เขียน
//   }else if(docType === 'sales'){
//     var collection_setData = global.dbColl_report_sales_item1 // เขียน
//   }


//   const client = new MongoClient(global.dbUrl);  
//   await client.connect()
//   try{ 
//     //=== 0.5) ฐานข้อมูล
//     // const { collectionName, docType, hoursCanEdit, hoursCanCancel } = myData.get_Info_ByUrl(req.originalUrl)
//     const db = client.db(global.dbName)
//     const coll_items = db.collection(global.dbColl_items)
//     const coll_getData = db.collection(collectionName)     // ฐานข้อมูลที่จะอ่านข้อมูล     
//     const coll_setData = db.collection(collection_setData) // ฐานข้อมูลที่จะเขียนข้อมูล

//     const dataItems = await coll_items.aggregate([
//       // { $match: {} }, // จับหมด
//       { $project: { 
//           _id: 0 ,
//           itemId: 1,             // '8851759450453',
//           itemPackageType: 1,    // 'single', // itemStock: 1, // '1',
//           categoryId: 1,         // 100,
//           itemStatus: 1,         // 'active',
//           itemName: 1,           // 'เจอร์ไฮ ลิเวอร์ สติิ๊ก(60กรัม)',
//           itemPrice: 1,          // 45,
//           itemUnit: 1,           // 'ซอง',
//           itemsInSet: 1,         // [],
//         } 
//       },
//       { $sort: { itemId: 1 } }
//     ]).toArray()
//     // console.log("dataItems ===> " , dataItems.length)
//     // console.log("dataItems[0] ===> " , dataItems[0])

//     const dataDocs = await coll_getData.aggregate([
//       { $match: { docStatusNumber: 2 } }, // จับเฉพาะที่จบแล้วเท่านั้น
//       { $project: { 
//           _id: 0 ,
//           docId: 1 ,             // 'WI2509-00002',
//           docStatusNumber: 1 ,   // 2,
//           branchId: 1 ,          // 100,
//           userId: 1 ,            // 1000,
//           totalAmount: 1 ,       // 129,
//           docDate: 1 ,           // '2025-09-08',
//           tableRows: 1 ,         // [ [Object] ],
//         } 
//       },
//       { $sort: { docId: 1 } }
//     ]).toArray()
//     // dataDocs ===>  3

//     // const itemsMap = new Map(dataItems.map(item => [item.itemId, item]));
//     // console.log("itemsMap ===> " , itemsMap)


//     //=== แตก set ทุกชั้นจนเหลือแต่ single
//     function flattenSet(itemId, amount, itemsMap) {
//       const item = itemsMap.get(itemId);
//       if (!item) return [];

//       if (item.itemPackageType === 'single') {
//         // ถึงชั้นสุดท้ายแล้ว
//         return [{ itemId, itemName: item.itemName, itemAmount: amount, itemPackageType: 'single' }];
//       } else if (item.itemPackageType === 'set') {
//         // แตก set ต่อ
//         let result = [];
//         for (const setItem of item.itemsInSet) {
//           // คูณจำนวนชั้นบน
//           const sub = flattenSet(setItem.itemId, setItem.itemAmount * amount, itemsMap);
//           result = result.concat(sub);
//         }
//         return result;
//       }
//       return [];
//     }

//     //=== ใช้กับแต่ละ row ใน tableRows
//     function expandTableRow(row, itemsMap) {
//       const item = itemsMap.get(row.itemId);
//       if (!item) return row;

//       if (item.itemPackageType === 'single') {
//         return {
//           ...row,
//           itemPackageType: 'single',
//           itemsInSet_breakdown: [],
//           // itemQuantity_total: row.quantity,
//         };
//       } else if (item.itemPackageType === 'set') {
//         // แตก set ทุกชั้น
//         const singles = flattenSet(row.itemId, row.quantity, itemsMap);
//         // const itemQuantity_total = singles.reduce((sum, s) => sum + s.itemAmount, 0);
//         return {
//           ...row,
//           itemPackageType: 'set',
//           itemsInSet_breakdown: singles,
//           // itemQuantity_total,
//         };
//       }
//       return row;
//     }

//     // ตัวอย่างการใช้งาน
//     function expandWarehouseDocs(docs, itemsArr) {
//       const itemsMap = new Map(itemsArr.map(item => [item.itemId, item]));
//       return docs.map(doc => ({
//         ...doc,
//         tableRows: doc.tableRows.map(row => expandTableRow(row, itemsMap))
//       }));
//     }

//     const dataDocsProcessed = expandWarehouseDocs(dataDocs, dataItems)

//     //=== เขียนลงฐานข้อมูล
//     await coll_setData.deleteMany({})
//     if(dataDocsProcessed.length > 0){
//       const result = await coll_setData.insertMany(dataDocsProcessed)
//       console.log(`${result.insertedCount} documents were inserted`);
//     }

//     return res.send(JSON.stringify({
//       isCreate:true, 
//       class:"green", 
//       msg: "สร้างรายงานขั้นที่เรียบร้อยแล้ว"
//     }))
//   } catch(err){
//     console.log(err)
//     return res.send(JSON.stringify({
//       isCreate:false, 
//       class:"red", 
//       msg: err.message
//     }))
//   }
// })





// router.get(PATH_REPORT_ITEMS2_ARR, mainAuth.isAuth, async (req, res) => {
//   // console.log(`-----------------${req.originalUrl}------------------`)
//   // console.log(req.body)

//   //=== 0.) จับชื่อคอเล็กชั่นจาก URL
//   const { docType } = myData.get_Info_ByUrl(req.originalUrl)
//   if(docType === 'warehouseIn'){
//     var collection_getData = global.dbColl_report_warehouseIn_item1 // อ่าน
//     var collection_setData = global.dbColl_report_warehouseIn_item2 // เขียน
//   }else if(docType === 'warehouseOut'){
//     var collection_getData = global.dbColl_report_warehouseOut_item1 // อ่าน
//     var collection_setData = global.dbColl_report_warehouseOut_item2 // เขียน
//   }else if(docType === 'sales'){
//     var collection_getData = global.dbColl_report_sales_item1 // อ่าน
//     var collection_setData = global.dbColl_report_sales_item2 // เขียน
//   }


//   const client = new MongoClient(global.dbUrl);  
//   await client.connect()
//   try{ 
//     //=== 1) ฐานข้อมูล
//     const db = client.db(global.dbName)
//     const coll_items = db.collection(global.dbColl_items)
//     const coll_getData = db.collection(collection_getData) // ฐานข้อมูลที่จะอ่านข้อมูล     
//     const coll_setData = db.collection(collection_setData) // ฐานข้อมูลที่จะเขียนข้อมูล

//     //=== 2) ดึงข้อมูลไอเท็มทั้งหมด (สำหรับ lookup itemName)
//     const dataItems = await coll_items.aggregate([
//       { $project: { _id: 0, itemId: 1, itemName: 1, itemPackageType: 1 } },
//       { $sort: { itemId: 1 } }
//     ]).toArray()
//     const itemNameMap = new Map(dataItems.map(item => [item.itemId, item.itemName]))

//     //=== 3) ดึงข้อมูลจากขั้นตอนที่ 1 (tableRows)
//     const dataDocsProcessedStep1 = await coll_getData.find(
//       {},
//       { projection: { _id: 0, tableRows: 1 } }
//     ).toArray()

//     //=== 4) รวม tableRows ทั้งหมดจากทุก doc
//     let allRows = []
//     for(const doc of dataDocsProcessedStep1){
//       if(Array.isArray(doc.tableRows)){
//         allRows = allRows.concat(doc.tableRows)
//       }
//     }

//     //=== 5) สรุปยอด quantity ของแต่ละ itemId (รวมทั้งที่อยู่ใน itemsInSet_breakdown)
//     const quantityMap = new Map()
//     for(const row of allRows){
//       // 5.1) ถ้าเป็น single เท่านั้นถึงจะบวก quantity หลัก
//       if(row.itemId && row.itemPackageType === 'single'){
//         quantityMap.set(row.itemId, (quantityMap.get(row.itemId) || 0) + (row.quantity || 0))
//       }
//       // 5.2) ถ้าเป็น set ให้ข้ามไปดูใน itemsInSet_breakdown เท่านั้น
//       if(Array.isArray(row.itemsInSet_breakdown) && row.itemsInSet_breakdown.length > 0){
//         for(const sub of row.itemsInSet_breakdown){
//           if(sub.itemId && sub.itemAmount){
//             quantityMap.set(sub.itemId, (quantityMap.get(sub.itemId) || 0) + sub.itemAmount)
//           }
//         }
//       }
//     }

//     //=== 6) สร้าง array ผลลัพธ์แบบ unique itemId
//     const summaryArr = Array.from(quantityMap.entries()).map(([itemId, quantity]) => ({
//       itemId,
//       itemName: itemNameMap.get(itemId) || '',
//       itemPackageType: dataItems.find( obj => obj.itemId == itemId)?.itemPackageType || '',
//       quantity
//     }))
//     summaryArr.sort((a, b) => a.itemId.localeCompare(b.itemId))

//     //=== 7) เขียนลงฐานข้อมูล (ลบข้อมูลเดิมก่อน)
//     await coll_setData.deleteMany({})
//     if(summaryArr.length > 0){
//       const result = await coll_setData.insertMany(summaryArr)
//       console.log(`${result.insertedCount} documents were inserted`);
//     }

//     return res.send(JSON.stringify({
//       isCreate:true, 
//       class:"green", 
//       msg: "สร้างรายงานสรุปยอดไอเท็มเรียบร้อยแล้ว"
//     }))
//   } catch(err){
//     console.log(err)
//     return res.send(JSON.stringify({
//       isCreate:false, 
//       class:"red", 
//       msg: err.message
//     }))
//   }
// })




// แตก itemsInSet ออกมาเป็น single
// const PATH_REPORT_ITEMS1_ARR = [`${WAREHOUSE_IN}/item-1`, `${WAREHOUSE_OUT}/item-1`, `${SALES}/item-1`]
// นับจำนวนของแต่ละไอเท็ม
// const PATH_REPORT_ITEMS2_ARR = [ `${WAREHOUSE_IN}/item-2`, `${WAREHOUSE_OUT}/item-2`, `${SALES}/item-2`]