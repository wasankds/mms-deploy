// //==== แจ้งเตือน Telegram
// // บ็อต @wasankds_bot
// // กลุ่ม  wasankds_group
// global.botToken = '8046567910:AAG8IhMqBMfxenMqbZapeULZGS546k83s28';
// global.groupChatId = '-4557511552';
// 
import path from 'path'
// import { MongoClient } from 'mongodb';
const myData = await import(`./${global.mymoduleFolder}/myData.js`)
global.SYS_NAME = 'MMS'
global.SYS_NAME2 = ''
global.SYS_VERSION = '2.0.0'
global.SYS_OWNER_FULLNAME = 'นายวสันต์ คุณดิลกเศวต'
global.SYS_OWNER_EMAIL = 'wasankds@gmail.com'
global.SYS_OWNER_PHONE = '081-459-8343'
// PATH ใช้เหมือนกันหมด
global.PATH_GET_ALERTS_USER = `/get-alerts-user`     // alertsRouter.js
global.PATH_GET_ALERTS_USER_DEVICE = `/get-alerts-user-device` // alertsRouter.js
// Database
global.dbName = process.env.DB_NAME
global.dbUrl = process.env.DB_URL
global.dbColl_settings = 'settings'
global.dbColl_settingsSystem = 'settingsSystem'
global.dbColl_sessions = 'sessions'
global.dbColl_users = 'users'
global.dbColl_usersResetPassword = 'usersResetPassword'
global.dbColl_devices = 'devices'
global.dbColl_deviceSorting = 'deviceSorting'
global.dbColl_alerts = 'alerts'
global.dbColl_keysDefinition = 'keysDefinition'
global.dbColl_docs = 'docs' // เก็บไว้ก่อน แม้ไม่ได้ใช้ตอนนี้
// ชื่อหน้าเว็บ
global.PAGE_HOME = 'MMS'
global.PAGE_DASHBOARD = 'แดชบอร์ด'
global.PAGE_MAP = 'แผนที่'
global.PAGE_DEVICES = 'คอนโทรลเลอร์'
global.PAGE_DEVICES_SORTING = 'ซ่อน/แสดง และเรียงลำดับอุปกรณ์'
global.PAGE_ALERTS = 'แจ้งเตือน'
global.PAGE_KEYS_DEFINITION = 'จัดการคีย์'
global.PAGE_DASHBOARD_SWITCH = 'แดชบอร์ดสวิตช์'
global.PAGE_TERM = 'ข้อกำหนดและเงื่อนไข'
global.PAGE_SYSTEM_MANUAL = 'การใช้งานระบบ'
global.PAGE_LOGIN = 'เข้าสู่ระบบ'
global.PAGE_USERS = 'ผู้ใช้งาน'
global.PAGE_USER_INFO = 'ข้อมูลผู้ใช้งาน'
global.PAGE_PASSWORD_FORGOT = 'ลืมรหัสผ่าน'
global.PAGE_PASSWORD_RESET = 'รีเซ็ตรหัสผ่าน'
global.PAGE_REPORT = 'รายงาน'
global.PAGE_MANAGE_USERS = 'จัดการผู้ใช้งาน'
global.PAGE_MANAGE_SETTINGS = 'ตั้งค่า'
global.PAGE_MANAGE_SETTINGS_SYSTEM = 'ตั้งค่าระบบ'
global.PAGE_MANAGE_SESSIONS = 'จัดการเซสชั่น'
//=== ค่าคงที่ทั่วระบบ
// MAX_POINTS
// จำนวนจุดสูงสุดของข้อมูลที่ต้องการแสดง (แกน x) - ในชาร์ต ใน dataById
// 12ชั่วโมง = 72 จุด, 8ชั่มโมง = 48 จุด, 6ชั่วโมง = 36 จุด, 3ชั่วโมง = 18 จุด
global.MAX_POINTS = 48
global.BCRYPT_NUMBER = 12
global.USER_AUTHORITIES = ["O", "A", "U"]
global.USER_AUTHORITIES_TABLE = [ 
  { auth: "O", name : 'Owner', nameThai : 'เจ้าของระบบ' }, 
  { auth: "A", name : 'Admin', nameThai : 'ผู้ดูแลระบบ' }, 
  { auth: "U", name : 'User', nameThai : 'พนักงาน' }
]
global.USER_AUTHORITIES_TITLE = global.USER_AUTHORITIES_TABLE.reduce( (acc, obj) => {  
  acc += `${obj.auth} : ${obj.name} (${obj.nameThai})` + '\n'
  return acc
}, 'สิทธิ์ของผู้ใช้งาน\n\n');

//=== ค่าคงที่ใช้ทุกที่ *** ใช้ทำ dropwn เลือกสีอุปกรณ์  ***
global.DEVICES_COLOR =  [
  { bgClassColor : 'bg-liblue', bgName : 'ฟ้าอ่อน' } ,
  { bgClassColor : 'bg-cornblue', bgName : 'ฟ้าดอกไม้' } ,
  { bgClassColor : 'bg-dkcyan', bgName : 'ฟ้าเข้ม' } ,
  { bgClassColor : 'bg-dodgerblue', bgName : 'น้ำเงินสด' } ,
  { bgClassColor : 'bg-plum', bgName : 'ลูกพลัม' } ,
  { bgClassColor : 'bg-ligreen', bgName : 'เขียวอ่อน' } ,
  { bgClassColor : 'bg-goldenrod', bgName : 'เหลืองทอง' } ,
]

// Message ต่างๆ
global.USERNAME_PATTERN = "^[a-z0-9_\\.\\-]{6,}$"
global.USERNAME_DESCRIPTION = "อักษรที่สามารถใช้เป็นชื่อยูสเซอร์ได้ a-z, 0-9, . , - อย่างน้อย 6 ตัวอักษร"
global.USER_SIGNATURE_DESCRIPTION = "ไฟล์ภาพ .png ไม่เกิน 1MB เท่านั้น ขนาดที่แนะนำ 330x120px"
global.PASSWORD_PATTERN = "^[a-zA-Z0-9._!@#%&*+\\-=]{6,}$"
global.PASSWORD_DESCRIPTION = "อักษรที่สามารถใช้เป็นพาสเวิร์ดได้ a-z, A-Z, 0-9, ., _, !, @, #, %, &, *, -, +, = อย่างน้อย 6 ตัวอักษร"
global.EMAIL_PATTERN = "^[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
global.PHONE_PATTERN = "^[0-9]{9,10}$"
global.PHONE_DESCRIPTION = "เบอร์โทรศัพท์ 9-10 หลัก"
global.DEVICE_PATTERN_STRING = "^e\\d{3}$" // /^e\d{3}$/
global.DEVICE_REGEX = new RegExp(global.DEVICE_PATTERN_STRING)
global.DEVICE_DESCRIPTION = "รูปแบบไอดีอุปกรณ์ e + ตัวเลข 3 หลัก เช่น e001, e123"
global.DEVICE_KEY_PATTERN_STRING = "^[a-zA-Z0-9!@#$%^&+\\-]{7,10}$"
global.DEVICE_KEY_REGEX = new RegExp(global.DEVICE_KEY_PATTERN_STRING)
global.DEVICE_KEY_DESCRIPTION = "รูปแบบคีย์อุปกรณ์ ความยาว 7-10 ตัวอักษร a-z, A-Z, 0-9, !, @, #, $, %, ^, &, +, -"
global.TELEGRAM_BOT_TOKEN_PATTERN = "^[0-9]+:[A-Za-z0-9_]+$"
global.TELEGRAM_BOT_TOKEN_DESCRIPTION = "โทเค็นบ็อต Telegram เช่น 123456789:AAH..."
global.GROUP_CHAT_ID_PATTERN = "^-?[0-9]{9,}$"
global.GROUP_CHAT_ID_DESCRIPTION = "ไอดีกลุ่ม Telegram เช่น -123456789"
//=== ไฟล์และโฟลเดอร์
global.folderPublic = pathToFolder('public')
global.folderImages = pathToFolder('public','images')
global.folderViews = pathToFolder('views')
global.folderPartials = pathToFolder('views','partials')
global.folderForms = pathToFolder('views','forms')
global.folderDevices = pathToFolder('devices')
global.folderBackup = pathToFolder('backup')
global.file404 = pathToFolder('public','static', '404.html')
function pathToFolder( ...args){  
  const rootFolder = process.cwd()
  return path.join(rootFolder, ...args)
}
//==== ค่าที่ต้องจับจากฐานข้อมูล - อยุ่ล่างๆเพราะต้องใช้ค่าคงที่ฐานข้อมูล
global.SYS_KEYS_SWITCH = process.env.SYS_KEYS_SWITCH ? process.env.SYS_KEYS_SWITCH.split(',') : []
global.SWITCHES = [] // เก็บคีย์ที่เป็นสวิตช์
global.KEYS_DEFINITION = await myData.getKeyDefinition()
global.DATA_DEVICES = await myData.getDataDevices()
// global.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
// global.LOOP_TIME_DATA_DEVICES = Number(process.env.LOOP_TIME_DATA_DEVICES) || 30
// //=== จับข้อมุลเองจากฐานข้อมูล เพราะไฟล์ myData.js ยังโหลดไม่ได้
// const client = new MongoClient(global.dbUrl)
// await client.connect();
// try {
//   const db = client.db(global.dbName)

//   //=== จับ KEYS_DEFINITION
//   const coll_keysDefinition = db.collection(global.dbColl_keysDefinition)
//   const keysDefinition = await coll_keysDefinition.find(  
//     {}, // ทุกเอกสาร
//     { projection: { _id:0 } }
//   ).toArray()
//   if(keysDefinition.length  > 0){
//       global.KEYS_DEFINITION = keysDefinition ;
//     }else{
//       global.KEYS_DEFINITION = [
//         { key : 't', keyName : 'อุณหภูมิ', keyUnit: '°C' , bgColor: 'bg-dkcyan', fontColor : 'fc-darkcyan'   } , 
//         { key : 'h', keyName : 'ความชื้น', keyUnit: '%' , bgColor: 'bg-dodgerblue', fontColor : 'fc-dodgerblue' } ,
//         { key : 'i', keyName : 'กระแสไฟฟ้า', keyUnit: 'A' , bgColor: 'bg-lislateblue', fontColor : 'fc-slateblue' } , 
//         { key : 'v', keyName : 'โวลต์', keyUnit: 'V' , bgColor: 'bg-goldrod', fontColor : 'fc-goldrod' } ,
//         { key : 'd', keyName : 'ระยะทาง', keyUnit: 'cm' , bgColor: 'bg-forestgreen', fontColor : 'fc-forestgreen' } ,
//         { key : 'g', keyName : 'แก๊ส', keyUnit: 'ADC' , bgColor: 'bg-orchid', fontColor : 'fc-darkorchid' } ,
//         { key : 'sw', keyName : 'สวิตช์', keyUnit: '' , bgColor: 'bg-mediumturquoise', fontColor : 'fc-cornblue' } ,
//       ]
//     }

//   const coll_devices = db.collection(global.dbColl_devices)
//   const devices =  await coll_devices.find(
//     { deviceStatus : 'active'}, // ทุกเอกสาร
//     { projection: { 
//         // deviceKey : 1,
//         _id: 0,
//         changesHistory:0 ,
//         dateTimeCanDelete:0,
//         triggerRows:0 ,
//         dateTimeCanDelete : 0,
//         deviceTelegramGroupChatId : 0,
//         deviceTelegramNote : 0,
//         deviceTelegramNotify : 0,
//         deviceLatitude : 0,
//         deviceLongitude : 0,
//       } 
//     }
//   ).toArray()
//   global.DATA_DEVICES = devices || []
// } catch(err) {
//   console.log('Error myGlobal.js : ', err.message)
// } finally {
//   await client.close();
// }


global.NAV_LEFT = [
  { // 
    path: '/dashboard', 
    title: PAGE_DASHBOARD,
    icon: 'fas fa-tachometer-alt' ,
    menuColor : 'menu-blue', // ไม่มีในหน้า home
    userAuthorities: ['O','A','U'],
    separator: false,    
  },
  { // 
    path: '/dashboard-switch', 
    title: PAGE_DASHBOARD_SWITCH,
    icon: 'fas fa-toggle-on' ,
    menuColor : 'menu-pink', // ไม่มีในหน้า home
    userAuthorities: ['O'],
    separator: false,
  },
  { // 
    path: '/devices', 
    title: PAGE_DEVICES,
    icon: 'fas fa-microchip', 
    menuColor : 'menu-pink',
    userAuthorities: ['O','A'],
    separator: false,
  },
  { // 
    path: '/devices-sorting', 
    title: PAGE_DEVICES_SORTING,
    icon: 'fas fa-sort-amount-down', 
    menuColor : 'menu-pink',
    userAuthorities: ['O','A','U'],
    separator: false,
  },
  { // alert
    path: '/alerts', 
    title: PAGE_ALERTS,
    icon: 'fas fa-bell', 
    menuColor : 'menu-orange',
    userAuthorities: ['O','A'],
    separator: false,
  },
  { // 
    path: '/keys-definition', 
    title: PAGE_KEYS_DEFINITION,
    icon: 'fas fa-tag',
    menuColor : 'menu-orange',
    userAuthorities: ['O','A'],
    separator: false,
  },
  { // map
    path: '/map', 
    title: PAGE_MAP,
    icon: 'fas fa-map',
    menuColor : 'menu-green',
    userAuthorities: ['O','A','U'],
    separator: false,
  }
]


// global.NAV_REPORT = [  ]




global.NAV_USERS = [ // ผู้ใช้งาน
  {
    path: '/manage/users',
    title: PAGE_MANAGE_USERS,
    menuColor : 'menu-silver',
    icon: 'fas fa-users',
    userAuthorities: ['O','A'],
    separator: false
  },
  {
    path: '/manage/sessions',
    title: PAGE_MANAGE_SESSIONS,
    icon: 'fas fa-user-clock',
    menuColor : 'menu-silver',
    userAuthorities: ['O','A'],
    separator: false
  }
]

//======================== 
// เมนูด้านขวา
// 
global.NAV_RIGHT = [
  {
    path: '/manage/settings',
    title: PAGE_MANAGE_SETTINGS,
    icon: 'fas fa-sliders-h',
    menuColor : 'menu-silver',
    userAuthorities: ['O','A'],
    separator: false, 
  },
  {
    path: '/manage/settings/system',
    title: PAGE_MANAGE_SETTINGS_SYSTEM,
    icon: 'fas fa-gear',
    menuColor : 'menu-silver',
    userAuthorities: ['O'],
    separator: false
  },
  {
    path: '/term-and-conditions',
    title: PAGE_TERM,
    icon: 'fas fa-file-contract',
    menuColor : 'menu-silver',
    userAuthorities: ['O','A','U'],
    separator: false
  },
]
















  // {
  //   path: '/files-manager',
  //   title: PAGE_FILES_MANAGER,
  //   icon: 'fas fa-file-alt me-1',
  //   userAuthorities: ['O'],
  //   separator: false    
  // },
  // {
  //   path: '/manage/users',
  //   title: PAGE_MANAGE_USERS,
  //   icon: 'fas fa-users',
  //   userAuthorities: ['O'],
  //   separator: false    
  // },
  // {
  //   path: '/manage/users',
  //   title: PAGE_MANAGE_USERS,
  //   icon: 'fas fa-users',
  //   userAuthorities: ['O'],
  //   separator: false    
  // },
  // {
  //   path: '/manage/settings',
  //   title: PAGE_MANAGE_SETTINGS,
  //   icon: 'fas fa-sliders-h',
  //   userAuthorities: ['O'],
  //   separator: false
  // },
  // {
  //   path: '/manage/settings/system',
  //   title: PAGE_MANAGE_SETTINGS_SYSTEM,
  //   icon: 'fas fa-gear',
  //   userAuthorities: ['O'],
  //   separator: false
  // },












  

// global.dbColl_settings_Quotation = 'settings_Quotation'
// global.dbColl_settings_Invoice = 'settings_Invoice'
// global.dbColl_settings_Receipt = 'settings_Receipt'
// global.dbColl_settings_Bill = 'settings_Bill'


// global.dbColl_customers = 'customers' 
// global.dbColl_quotation = 'quotation' 
// global.dbColl_invoice = 'invoice' 
// global.dbColl_receipt = 'receipt'
// global.dbColl_bill = 'bill'



// global.dbColl_items = 'items' 
// global.dbColl_itemsCategory = 'itemsCategory' 
// global.dbColl_warehouseIn = 'doc_warehouseIn' 
// global.dbColl_warehouseOut = 'doc_warehouseOut' 
// global.dbColl_sales = 'doc_sales' 
// global.dbColl_report_warehouseIn_item1 = 'report_warehouseIn_item1' 
// global.dbColl_report_warehouseOut_item1 = 'report_warehouseOut_item1' 
// global.dbColl_report_sales_item1 = 'report_sales_item1' 
// global.dbColl_report_warehouseIn_item2 = 'report_warehouseIn_item2' 
// global.dbColl_report_warehouseOut_item2 = 'report_warehouseOut_item2' 
// global.dbColl_report_sales_item2 = 'report_sales_item2' 


// global.MICROCONTROLLER_TITLE = MICROCONTROLLER.reduce( (acc, obj) => {  
//   acc += `${obj.id} : ${obj.name}` + '\n'
//   return acc
// }, 'คอนโทรลเลอร์\n\n');


// global.KEYS_TITLE = KEYS.reduce( (acc, obj) => {  
//   acc += `${obj.key} : ${obj.keyName} (${obj.unit})` + '\n'
//   return acc
// }, 'คีย์\n\n');


// global.SYSTEM_START = {
//   PORT_SERVER : process.env.PORT_SERVER,
//   PORT_DEV : process.env.PORT_DEV,
//   DEPLOY : process.env.DEPLOY,
//   LOCALHOST_ALLOW : process.env.LOCALHOST_ALLOW,
//   DOMAIN_ALLOW : process.env.DOMAIN_ALLOW,
// }


// global.PAGE_MANAGE_USER_BRANCHES = 'จัดการสาขาผู้ใช้งาน'


// global.ITEM_TYPE_PATTERN = "^[a-zA-Z0-9_\\-]{5,}$"
// global.ITEM_TYPE_DESCRIPTION = "อักษรที่สามารถใช้เป็นไอดีได้ a-z, A-Z, 0-9, _, - อย่างน้อย 5 ตัวอักษร"


// ใช้จาก global ไปก่อนของจริงให้จับจาก settings 
// - ในอนาคต - ไปทำตั้งค่า ESP32  เพื่อเพิ่ม/แก้ไข/ลบ คอนโทรลเลอร์
// - ในอนาคต - ต้องสร้างปุ่มกด เพื่อให้จับค่ามาใส่ global.MICROCONTROLLER แทน
// - ในอนาคต - แก้ชื่อเป็น DEVICES
// const MICROCONTROLLER = [
//   { id: 'e001', name: 'โรงจอดรถ', bgColor: 'bg-liblue', 
//     keys : [
//       { key: 't', trigerMin: 20, trigerMax: 40 },
//       { key: 'h', trigerMin: 40, trigerMax: 90 },
//     ] 
//   },
//   { id: 'e002', name: 'หน้าบ้าน', bgColor: 'bg-plum', 
//     keys : [
//       { key: 't', trigerMin: 20, trigerMax: 40 },
//       { key: 'h', trigerMin: 40, trigerMax: 90 },
//       { key: 'd', trigerMin: 50, trigerMax: 1500 },
//     ]
//   },
//   { id: 'e003', name: 'ห้องครัว', bgColor: 'bg-ligreen', 
//     keys : [
//       { key: 't', trigerMin: 20, trigerMax: 40 },
//       { key: 'h', trigerMin: 40, trigerMax: 90 },
//       { key: 'g', trigerMax: 1500 },
//     ] 
//   },
//   // { id: 'e004', name: 'ทดสอบ4', bgColor: 'bg-goldenrod', 
//   //   keys : [ 
//   //     { key: 't', trigerMin: 20, trigerMax: 38 },
//   //     { key: 'h', trigerMin: 140, trigerMax: 8000 },
//   //   ]
//   // },

//   // กลุ่มสวิตช์
//   { id: 's001', name: 'สวิตช์1', bgColor: 'bg-mediumturquoise', 
//     keys : [
//       { key: 's1'},
//       { key: 's2'},
//     ]
//   },
// ]
// global.DEVICES = MICROCONTROLLER
// global.MICROCONTROLLER = MICROCONTROLLER



// global.SYS_KEYS = process.env.SYS_KEYS ? process.env.SYS_KEYS.split(',') : [] //