
// import { MongoClient } from 'mongodb';
// import { formatNumber_as_Thai } from  "./myModule.js"
// import * as myUsers from "./myUsers.js"
// import { getSessionData } from "./myUsers.js"


//=== 
const WAREHOUSE_IN = global.PATH_WAREHOUSE_IN
const WAREHOUSE_OUT = global.PATH_WAREHOUSE_OUT
const SALES = global.PATH_SALES
const PATH_IN = {
  PAGE : global.PAGE_WAREHOUSE_IN,
  DOC_TYPE : 'warehouseIn',  
  FA : `fas fa-arrow-circle-right`,
  LIST_TITLE : "รายการเข้า", // ข้อความแสดงเหนือ ตาราง item
  CLASS_COLOR : "fc-green",
  PATH_MAIN: WAREHOUSE_IN,
  PATH_SAVE: `${WAREHOUSE_IN}/save`,
  PATH_LOAD: `${WAREHOUSE_IN}/load`,
  PATH_LOAD_LAST: `${WAREHOUSE_IN}/load-last`, // โหลดเอกสารล่าสุด
  PATH_DELETE: `${WAREHOUSE_IN}/delete`,
  PATH_VIEW_IMAGE: `${WAREHOUSE_IN}/view-image`,
  PATH_CHANGES: `${WAREHOUSE_IN}/changes`,
  PATH_SEARCH: `${WAREHOUSE_IN}/search`,
  PATH_STATUS: `${WAREHOUSE_IN}/status`, // ใช้ทั้ง finish และ cancel
  PATH_PRINT: `${WAREHOUSE_IN}/print`,   // ใช้ได้ทั้ง PDF และ Image
  PATH_FETCH : `${WAREHOUSE_IN}/fetch/modal`,            // in/out เหมือนกัน
  PATH_FETCH_IMAGE  :  `items/fetch-image` , // สำหรับดูภาพ refImage ของเอกสาร Warehouse
  PREFIX: WAREHOUSE_IN.replace(/\//g,"_"),
}
const PATH_OUT = {
  PAGE : global.PAGE_WAREHOUSE_OUT,
  DOC_TYPE : 'warehouseOut',
  FA : `fas fa-arrow-circle-left`,
  LIST_TITLE : "รายการออก",
  CLASS_COLOR : "fc-orange",
  PATH_MAIN: WAREHOUSE_OUT,
  PATH_SAVE: `${WAREHOUSE_OUT}/save`,
  PATH_LOAD: `${WAREHOUSE_OUT}/load`,
  PATH_LOAD_LAST: `${WAREHOUSE_OUT}/load-last`, // โหลดเอกสารล่าสุด
  PATH_DELETE: `${WAREHOUSE_OUT}/delete`,
  PATH_VIEW_IMAGE: `${WAREHOUSE_OUT}/view-image`,
  PATH_CHANGES: `${WAREHOUSE_OUT}/changes`,
  PATH_SEARCH: `${WAREHOUSE_OUT}/search`,
  PATH_STATUS: `${WAREHOUSE_OUT}/status`, // ใช้ทั้ง finish และ cancel
  PATH_PRINT: `${WAREHOUSE_OUT}/print`,   // ใช้ได้ทั้ง PDF และ Image
  PATH_FETCH : `${WAREHOUSE_OUT}/fetch/modal`,            // in/out เหมือนกัน
  PATH_FETCH_IMAGE  :  `items/fetch-image`,
  PREFIX: WAREHOUSE_OUT.replace(/\//g,"_"), // สำหรับดูภาพ refImage ของเอกสาร Warehouse
}
const PATH_SALES = {
  PAGE : global.PAGE_SALES,
  DOC_TYPE : 'sales',
  FA : `fas fa-cash-register`,
  LIST_TITLE : "ขาย",
  CLASS_COLOR : "fc-cornblue",
  PATH_MAIN: SALES,
  PATH_SAVE: `${SALES}/save`,
  PATH_LOAD: `${SALES}/load`,
  PATH_LOAD_LAST: `${SALES}/load-last`, // โหลดเอกสารล่าสุด
  PATH_DELETE: `${SALES}/delete`,
  PATH_VIEW_IMAGE: `${SALES}/view-image`, // ไม่ได้ใช้ - แต่ติดไปเพราะ .ejs เดียวกัน
  PATH_CHANGES: `${SALES}/changes`,
  PATH_SEARCH: `${SALES}/search`,
  PATH_STATUS: `${SALES}/status`, // ใช้ทั้ง finish และ cancel
  PATH_PRINT: `${SALES}/print`,   // ใช้ได้ทั้ง PDF และ Image
  PATH_FETCH : `${SALES}/fetch/modal`,   // sales ต่างหาก
  PATH_FETCH_IMAGE  :  `items/fetch-image`, // สำหรับดูภาพ refImage ของเอกสาร Warehouse
  PREFIX: SALES.replace(/\//g,"_"),
}

//=============================================
// ใช้กับ 3 หน้า /warehouse-in , /warehouse-out , /sales
// ดักเส้นทาง แล้วส่ง pathObj ไป
// U - เข้าใช้งานหน้า warehouse-in , warehouse-out ไม่ได้
//
export async function getMainDocPathObj(req ,res,userAuthority) {
  if(!userAuthority){
    userAuthority = req.session.userAuthority
  }
  if(req.originalUrl.startsWith(WAREHOUSE_IN)){
    if( !['O','S','A'].includes(userAuthority) ){
      req.flash('msg', { class: "red", text: "ไม่มีสิทธิ์เข้าใช้งาน" });
      return res.redirect('/')
    }
    var pathObj = PATH_IN
  }else if(req.originalUrl.startsWith(WAREHOUSE_OUT)){
    if( !['O','S','A'].includes(userAuthority) ){
      req.flash('msg', { class: "red", text: "ไม่มีสิทธิ์เข้าใช้งาน" });
      return res.redirect('/')
    }
    var pathObj = PATH_OUT
  }else if(req.originalUrl.startsWith(SALES)){
    if( !['O','S','A','U'].includes(userAuthority) ){
      req.flash('msg', { class: "red", text: "ไม่มีสิทธิ์เข้าใช้งาน" });
      return res.redirect('/')
    }
    var pathObj = PATH_SALES
  }
  return pathObj
}









// //================================================
// // จับข้อมูลผู้ใช้ทั้งหมด  - สำหรับใช้ทำ Modal
// // 
// export async function getCustomers_for_Modal() {
//   const client = new MongoClient(global.dbUrl)
//   try{
//     await client.connect()
//     const db = client.db(global.dbName)
//     const collection = db.collection(global.dbColl_customers)
//     var DATA_CUSTOMERS =  await collection.find(
//       { customerStatus: 'active' },
//       { projection : { 
//           _id : 0 ,
//           customerId: 1,         //  10004,
//           customerStatus: 1,     //  'active',
//           customerName: 1,       //  'ห้างหุ้นส่วนจำกัด สมาร์ทเทค',
//           customerType: 1,       //  
//           customerAddress1: 1,   //  '12/34 ถนนรามคำแหง แขวงหัวหมาก เขตบางกะปิ',
//           customerAddress2: 1,   //  'กรุงเทพมหานคร 10240',
//           customerTaxId: 1,      //  '3456789012345',
//           customerIdentityId: 1, //  '',
//           customerWebsite: 1,    //  'www.ssssmmmmttttt.com',
//           customerPhone: 1,      //  'โทรฯ 012-012-0123',
//           customerEmail: 1,      //  'ssssmmmmttttt@smt.co.th',
//           customerContactPerson: 1, 
//         }
//       }
//     ).toArray()

//     return DATA_CUSTOMERS
//   }catch(err){
//     console.log(err)
//     throw err
//   }finally{
//     client.close()
//   }
// }


// //================================================
// // จับข้อมูลผู้ใช้ทั้งหมด  - สำหรับใช้ทำรายงาน
// // 
// export async function getUsers_for_report() {
//   const client = new MongoClient(global.dbUrl)
//   try{
//     await client.connect()
//     const db = client.db(global.dbName)
//     const collection = db.collection(global.dbColl_users)

//     var dataUsers =  await collection.find(
//       { userIsActive: 'active' },
//       { projection : { 
//           _id: 0 , 
//           userIsActive: 1 ,
//           userId: 1 , 
//           userAuthority: 1 , 
//           userFullname: { $concat: ["$userPrefix"," ","$userFirstname"," ","$userLastname"] },
//         }
//       }
//     ).toArray()
//     // console.log(dataUsers)

//     return dataUsers
//   }catch(err){
//     console.log(err)
//     throw err
//   }finally{
//     client.close()
//   }
// }


// //================================================
// // จับข้อมูลไอเท็มทั้งหมด  - สำหรับใช้ทำรายงาน
// //
// export async function getItems_for_report() {
//   const client = new MongoClient(global.dbUrl)
//   try{
//     await client.connect()
//     const db = client.db(global.dbName)
//     const coll_items = db.collection(global.dbColl_items)

//     const dataItems = await coll_items.aggregate([
//       // { $match: {} },
//       { $project: { _id: 0 } },
//       { $sort: { itemId: 1 } }
//     ]).toArray()
//     dataItems.forEach( obj => {
//       for( let key in obj){
//         if (key == 'itemName' || key == 'itemDesc') {
//           obj[key] = obj[key].replace(/"/g, `\\"`).replace(/\r\n|\r|\n/g,"\\n")
//         }
//       }
//     })

//     return dataItems
//   }catch(err){
//     console.log(err)
//     throw err
//   }finally{
//     client.close()
//   }
// }




// //================================================
// //
// //
// export async function getDocs_Conclude(collDocName) {
//     const client = new MongoClient(global.dbUrl)
//   try{
//     await client.connect()
//     const db = client.db(global.dbName)
//     const collection = db.collection(collDocName)
//     const dataDocConclude = await collection.find(
//       {},
//       { projection : { 
//           _id: 0, 
//           docId:1, 
//           docDate:1, 
//           docStatusNumber:1, 
//           customerName:1 
//         } 
//       }
//     ).toArray()

//     return dataDocConclude
//   }catch(err){
//     console.log(err)
//     throw err
//   }finally{
//     client.close()
//   }
// }





// //================================================
// // ใช้สำหรับจับชื่อ collection จาก docTitle
// // เช่น docTitle === global.PAGE_QUOTATION จะได้ global.dbColl_quotation
// // 
// export function getCollName_by_DocTitle(docTitle) {

//   //=== เอกสาร
//   if(docTitle === global.PAGE_QUOTATION){
//     var collName = global.dbColl_quotation
//   }else  if(docTitle === global.PAGE_INVOICE){
//     var collName = global.dbColl_invoice
//   }else if(docTitle === global.PAGE_RECEIPT){
//     var collName = global.dbColl_receipt
//   }else if(docTitle === global.PAGE_BILL){
//     var collName = global.dbColl_bill
//   }
//   //=== รายงาน
//   else if(docTitle === global.PAGE_REPORT_QUOTATION){
//     var collName = global.dbColl_quotation
//   }else if(docTitle === global.PAGE_REPORT_INVOICE){
//     var collName = global.dbColl_invoice
//   }else if(docTitle === global.PAGE_REPORT_RECEIPT){
//     var collName = global.dbColl_receipt
//   }else if(docTitle === global.PAGE_REPORT_BILL){
//     var collName = global.dbColl_bill
//   }
//   //=== อื่นๆ - ไม่ควรมีแบบนี้ 
//   else{
//     var collName = ''
//   }
//   return collName
// }



// //============================================= 
// // แปลงชนิดข้อมูล พร้อมสำหรับการเขียนลง DB
// // - ใช้กับ quotation/invoice
// // - ไม่ได้เแปลงทุกตัว แปลงเฉพาะที่ต้องเป็นตัวเลข
// export function convert_DocDataType(doc) {
//   doc.docStatusNumber = doc.docStatusNumber ? Number(doc.docStatusNumber) : doc.docStatusNumber 
//   doc.customerId = doc.customerId ? Number(doc.customerId) : doc.customerId 
//   doc.proposerId = doc.proposerId ? Number(doc.proposerId) : doc.proposerId  
//   doc.totalAmount = doc.totalAmount ? Number(doc.totalAmount) : doc.totalAmount
//   doc.vatAmount = doc.vatAmount ? Number(doc.vatAmount) : doc.vatAmount
//   doc.netAmount = doc.netAmount ? Number(doc.netAmount) : doc.netAmount
//   //=== แก้ type ใน tableRows
//   doc.tableRows = doc.tableRows.map(row => {
//     return {
//       index : !isNaN(row.index) ? Number(row.index) : row.index , // เป็นตัวเลขตั้งแต่แรกอยู่แล้ว
//       itemId: row.itemId, // สตริง
//       no: row.no,         // สตริง
//       description: row.description, // สตริง
//       unit: row.unit ,    // สตริง
//       price: !isNaN(row.price) ? Number(row.price) : row.price, // ตัวเลข ***
//       quantity: !isNaN(row.quantity) ? Number(row.quantity) : row.quantity, // ตัวเลข ***
//       amount: !isNaN(row.amount) ? Number(row.amount) : row.amount // ตัวเลข ***
//     }
//   })
//   return doc
// }






// //============================================= 
// // จับชื่อ collection จาก path
// // เช่น /warehouse/in จะได้ global.dbColl_warehouseIn
// // 
// export function get_Warehouse_DbName(originalUrl) {
//   if(originalUrl.startsWith(global.PATH_WAREHOUSE_IN)){
//     return {
//       collectionName: global.dbColl_warehouseIn,
//       warehouseType : 'in'  // เพิ่มเติม เพื่อใช้ในฟังก์ชัน create_Row() ใน warehouse_modal.js
//     }
//   }else if(originalUrl.startsWith(global.PATH_WAREHOUSE_OUT)){
//     return {
//       collectionName:global.dbColl_warehouseOut,
//       warehouseType : 'out'  // เพิ่มเติม เพื่อใช้ในฟังก์ชัน create_Row() ใน warehouse_modal.js
//     }
//   }
// }
// //============================================= 
// // จับชื่อโฟลเดอร์ จาก path
// // เช่น /warehouse/in จะได้ global.folderWarehouseIn
// // 
// export function get_Warehouse_FolderName(originalUrl) {
//   if(originalUrl.startsWith(global.PATH_WAREHOUSE_IN)){
//     return {folderName: global.folderWarehouseIn}
//   }else if(originalUrl.startsWith(global.PATH_WAREHOUSE_OUT)){
//     return {folderName: global.folderWarehouseOut}
//   }
// }