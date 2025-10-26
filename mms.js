import 'dotenv/config'
import express from 'express'
import session from 'express-session'
import cookieParser from 'cookie-parser'
import flash from 'connect-flash'
import MongoDBSession from 'connect-mongodb-session' 
import { createServer } from 'node:http';
import { Server } from 'socket.io'
const routesFolder = global.IS_PRODUCTION ? 'routes-min' : 'routes'
global.mymoduleFolder = global.IS_PRODUCTION ? 'mymodule-min' : 'mymodule'
await import(`./${global.mymoduleFolder}/myGlobal.js`)
await import(`./${global.mymoduleFolder}/myScheduleBackupDatabase.js`)  // ไม่ต้องก็ได้ เปลี่ยนไปใช้วิธีเมื่อบันทึกข้อมูลอุปกรณ์ใดๆ ก็ตามให้อัปเดทข้อมูลใน global ทันที
await import(`./${global.mymoduleFolder}/myScheduleDevices.js`)  // ไม่ต้องก็ได้ เปลี่ยนไปใช้วิธีเมื่อบันทึกข้อมูลอุปกรณ์ใดๆ ก็ตามให้อัปเดทข้อมูลใน global ทันที
process.env.RANDOM_DATA == '1' ? await import(`./${global.mymoduleFolder}/myRandomData.js`) : null
const app = express()
const server = createServer(app)
const io = new Server(server)
global.io = io;
//=== Sessionss
const MongoStore = MongoDBSession(session)
app.use(session({
  secret: 'mms.node.apps.key.sign.cookie',
  cookie: {
    maxAge: 1000*60*60*24*30,
    // secure: process.env.DEPLOY == 'dev' ? false : true,
    httpOnly: IS_PRODUCTION ? true : false,
  },
  resave: false,
  saveUninitialized: false,
  store: new MongoStore({
    uri: dbUrl,
    databaseName: dbName,
    collection: dbColl_sessions,
  }),
}))
app.set('view engine', 'ejs')
app.use(flash())
app.use(cookieParser())
app.use(express.json({limit:'50mb'}))
app.use(express.urlencoded({extended:true,limit:'50mb'}))
app.use(express.static(global.folderPublic))
app.use((req, res, next) => {
  const allowedOrigins = [ global.DOMAIN_ALLOW ]
  if(!IS_PRODUCTION){
    allowedOrigins.push(`${process.env.LOCALHOST_ALLOW}:${global.PORT}`)
    allowedOrigins.push(`http://127.0.0.1:5500`)
  }
  const origin = req.headers.origin
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin)
  } else {
    res.header('Access-Control-Allow-Origin', 'null') 
  }
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  next()
})
app.use('/', (req, res, next) => { req.io = io; next() })
if( process.env.USE_STARTAPP_ROUTER == 1 )
app.use((await import(`./${routesFolder}/startAppRouter.js`)).default);
app.use((await import(`./${routesFolder}/homeRouter.js`)).default) ;
app.use((await import(`./${routesFolder}/loginRouter.js`)).default);
app.use((await import(`./${routesFolder}/manageSettingsRouter.js`)).default);
app.use((await import(`./${routesFolder}/manageSettingsSystemRouter.js`)).default);
app.use((await import(`./${routesFolder}/manageSessionsRouter.js`)).default);
app.use((await import(`./${routesFolder}/manageUsersRouter.js`)).default);
app.use((await import(`./${routesFolder}/userInfoRouter.js`)).default);
app.use((await import(`./${routesFolder}/passwordRouter.js`)).default);
app.use((await import(`./${routesFolder}/devicesRouter.js`)).default);
app.use((await import(`./${routesFolder}/keysDefinitionRouter.js`)).default);
app.use((await import(`./${routesFolder}/dashboardRouter.js`)).default);
app.use((await import(`./${routesFolder}/dataInRouter.js`)).default);
app.use((await import(`./${routesFolder}/dataByIdRouter.js`)).default);
app.use((await import(`./${routesFolder}/dashboardSwitchRouter.js`)).default);
app.use((await import(`./${routesFolder}/dataInSwitchRouter.js`)).default);
app.use((await import(`./${routesFolder}/alertsRouter.js`)).default);
app.use((await import(`./${routesFolder}/reportByIdRouter.js`)).default);
app.use( (err, req, res, next) => {
  res.status(err.status || 500);
  const errHtml = `<h1 style="color:blue">กำลังอัปเดทข้อมูล</h1>
    <p style="color:red">"err.status ===> " ${err.status}</p>
    <p style="color:red">"err.stack ===> " ${err.stack}</p>`
  res.send(errHtml)
  next()
})
app.get('*', (req,res) => {
  res.status(404).sendFile(file404)
})

//=== Start the server
server.listen(global.PORT, () => {
  console.log(`========== Server@${DOMAIN_ALLOW} ===========`)
  console.log("IS_PRODUCTION ", global.IS_PRODUCTION)
  console.log("global.DOMAIN_ALLOW ", global.DOMAIN_ALLOW)
  console.log("Process PID:", process.pid)
})






