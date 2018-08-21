"use strict";var __awaiter=this&&this.__awaiter||function(thisArg,_arguments,P,generator){return new(P||(P=Promise))(function(resolve,reject){function fulfilled(value){try{step(generator.next(value))}catch(e){reject(e)}}function rejected(value){try{step(generator["throw"](value))}catch(e){reject(e)}}function step(result){result.done?resolve(result.value):new P(function(resolve){resolve(result.value)}).then(fulfilled,rejected)}step((generator=generator.apply(thisArg,_arguments||[])).next())})};Object.defineProperty(exports,"__esModule",{value:true});const cluster=require("cluster");const express=require("express");const parser=require("body-parser");const os=require("os");const mkdirp=require("mkdirp");const yargs=require("yargs");const pgPromise=require("pg-promise");const pgtools=require("pgtools");const Ajv=require("ajv");const DiffMatchPatch=require("diff-match-patch");require("axios");const axios_1=require("axios");const argv=yargs.argv;argv.name=argv.name||process.env.SCRIBE_APP_NAME||process.env.HOSTNAME||"localhost";argv.home=argv.home||process.env.SCRIBE_APP_HOME||process.cwd();argv.port=argv.port||process.env.SCRIBE_APP_PORT||process.env.PORT||1337;argv.mode=argv.mode||process.env.SCRIBE_APP_MODE||process.env.NODE_MODE||"development";argv.dbHost=argv.dbHost||process.env.SCRIBE_APP_DB_HOST||"localhost";argv.dbPass=argv.dbPass||process.env.SCRIBE_APP_DB_PASS||"";argv.dbUser=argv.dbUser||process.env.SCRIBE_APP_DB_USER||"";argv.dbPort=argv.dbPort||process.env.SCRIBE_APP_DB_PORT||5432;argv.dbName=argv.dbName||process.env.SCRIBE_APP_DB_NAME||"scribe";argv.appSchemaBaseUrl=argv.appSchemaBaseUrl||process.env.SCRIBE_APP_SCHEMA_BASE_URL||"http://localhost:8080/";const dbCreateConfig={user:argv.dbUser,password:argv.dbPass,port:argv.dbPort,host:argv.dbHost};pgtools.createdb(dbCreateConfig,argv.dbName).then(res=>{console.log(res)}).catch(err=>{if(err.pgErr===undefined||err.pgErr.code!=="42P04"){console.error(err)}});const dbConnectConfig=dbCreateConfig;dbConnectConfig["database"]=argv.dbName;const pgp=pgPromise({});const postgresDb=pgp(dbConnectConfig);if(cluster.isMaster){let cores=os.cpus();for(let i=0;i<cores.length;i++){cluster.fork()}cluster.on("exit",worker=>{cluster.fork()})}else{createServer()}const get=(p,o)=>p.reduce((xs,x)=>xs&&xs[x]?xs[x]:null,o);function createServer(schemaOverride=undefined){class DB{constructor(db){this.db=db;let defaultSchema=schemaOverride;if(schemaOverride===undefined){defaultSchema=require(__dirname+"/default.table.schema.json")}this.defaultSchema=defaultSchema}getComponentSchema(component){return __awaiter(this,void 0,void 0,function*(){const ajv=new Ajv;let defaultSchema={schema:this.defaultSchema,validator:ajv.compile(this.defaultSchema)};if(argv.appSchemaBaseUrl===undefined){return defaultSchema}try{let response=yield axios_1.default.get(`${argv.appSchemaBaseUrl}${component}/schema`);if(response.data===undefined){return defaultSchema}return{schema:response.data,validator:ajv.compile(response.data)}}catch(err){console.error(err)}return defaultSchema})}formatQueryData(data,schema){let queryData={sqlColumnSchemas:[],sqlColumnNames:[],sqlColumnIndexes:[],dataArray:[]};let ignoredKeyCount=0;Object.keys(schema.properties).forEach(function(key,index){if(key!=="id"){queryData.sqlColumnNames.push(key);queryData.sqlColumnIndexes.push(`$${index-ignoredKeyCount+1}`);queryData.dataArray.push(JSON.stringify(data[key]));let property=schema.properties[key];switch(property.type){case"integer":queryData.sqlColumnSchemas.push(`${key} integer`);break;case"string":if(property.format==="date-time"){queryData.sqlColumnSchemas.push(`${key} timestamp`)}else{queryData.sqlColumnSchemas.push(`${key} text`)}break;case"object":queryData.sqlColumnSchemas.push(`${key} json`);case"number":queryData.sqlColumnSchemas.push(`${key} float8`);default:break}}else{ignoredKeyCount++}});return queryData}createSingle(component,data,schema){return __awaiter(this,void 0,void 0,function*(){let queryData=this.formatQueryData(data,schema);let createQuery=`CREATE TABLE IF NOT EXISTS ${component}(id serial PRIMARY KEY, ${queryData.sqlColumnSchemas.join(",")})`;let createHistoryQuery=`CREATE TABLE IF NOT EXISTS ${component}_history(id serial PRIMARY KEY, foreignKey integer REFERENCES ${component} (id) ON DELETE CASCADE, patches json)`;let ensureAllColumnsExistQuery=`ALTER TABLE ${component} ADD COLUMN IF NOT EXISTS ${queryData.sqlColumnSchemas.join(", ADD COLUMN IF NOT EXISTS ")}`;let insertQuery=`INSERT INTO ${component}(${queryData.sqlColumnNames.join(",")}) values(${queryData.sqlColumnIndexes.join(",")}) RETURNING *`;let insertHistoryQuery=`INSERT INTO ${component}_history(foreignKey, patches) values($1, CAST ($2 AS JSON)) RETURNING *`;try{yield this.db.query(createQuery);yield this.db.query(createHistoryQuery);yield this.db.query(ensureAllColumnsExistQuery);let result=yield this.db.query(insertQuery,queryData.dataArray);let resultString=JSON.stringify(result[0]);const dmp=new DiffMatchPatch.diff_match_patch;let diff=dmp.patch_make(resultString,"");let diffValues=[result[0].id,JSON.stringify([dmp.patch_toText(diff)])];let historyResult=yield this.db.query(insertHistoryQuery,diffValues);return result}catch(err){console.log(err);return[]}})}getAll(component,filter){return __awaiter(this,void 0,void 0,function*(){let getQuery=`SELECT * FROM ${component} ORDER BY id`;try{let response=yield this.db.query(getQuery);if(filter){try{filter=JSON.parse(filter);response=response.filter(entry=>{let matchedFilters=0;let filterCount=Object.keys(filter).length;for(let key in filter){let nestedKeyArray=key.split(".");let entryValue=get(nestedKeyArray,entry);if(entryValue){let filterArray;if(filter[key]instanceof Array){filterArray=filter[key]}else{filterArray=[filter[key]]}if(filterArray.find(x=>JSON.stringify(x)===JSON.stringify(entryValue))){matchedFilters++}}}return matchedFilters===filterCount})}catch(err){console.error(err);console.error("Failed to apply filter: ");console.error(filter)}}return response}catch(err){console.error(err);return[]}})}getSingle(component,id){return __awaiter(this,void 0,void 0,function*(){let getQuery=`SELECT * FROM ${component} WHERE id=$1 ORDER BY id`;try{let response=yield this.db.query(getQuery,id);return response}catch(err){console.error(err);return[]}})}getSingleHistory(component,id){return __awaiter(this,void 0,void 0,function*(){try{let rawHistory=yield this.getSingleHistoryRaw(component,id);rawHistory=rawHistory[0];let currentVersion=yield this.getSingle(component,id);currentVersion=JSON.stringify(currentVersion[0]);const dmp=new DiffMatchPatch.diff_match_patch;let oldVersions=[];oldVersions.push(JSON.parse(currentVersion));for(let i=rawHistory.patches.length-1;i>=1;i--){currentVersion=dmp.patch_apply(dmp.patch_fromText(rawHistory.patches[i]),currentVersion)[0];oldVersions.push(JSON.parse(currentVersion))}return oldVersions}catch(err){console.error(err);return[]}})}getAllHistory(component,filter){return __awaiter(this,void 0,void 0,function*(){try{let allRows=yield this.getAll(component,filter);let allHistory=[];for(let entry of allRows){let history=yield this.getSingleHistory(component,entry.id);allHistory.push({id:entry.id,history:history})}return allHistory}catch(err){console.error(err);return[]}})}updateSingle(component,id,data,schema){return __awaiter(this,void 0,void 0,function*(){let queryData=this.formatQueryData(data,schema);let updateQuery=`UPDATE ${component} SET (${queryData.sqlColumnNames.join(",")}) = (${queryData.sqlColumnIndexes.join(",")}) WHERE id = ${id} RETURNING *`;let updateHistoryQuery=`UPDATE ${component}_history SET patches = $1 WHERE foreignKey = ${id} RETURNING *`;let ensureAllColumnsExistQuery=`ALTER TABLE ${component} ADD COLUMN IF NOT EXISTS ${queryData.sqlColumnSchemas.join(", ADD COLUMN IF NOT EXISTS ")}`;try{let oldVersion=yield this.getSingle(component,id);let oldHistory=yield this.getSingleHistoryRaw(component,id);yield this.db.query(ensureAllColumnsExistQuery);let result=yield this.db.query(updateQuery,queryData.dataArray);const dmp=new DiffMatchPatch.diff_match_patch;let diff=dmp.patch_make(JSON.stringify(result[0]),JSON.stringify(oldVersion[0]));oldHistory[0].patches.push(dmp.patch_toText(diff));let historyResult=yield this.db.query(updateHistoryQuery,JSON.stringify(oldHistory[0].patches));return result}catch(err){console.error(err);return[]}})}deleteSingle(component,id){return __awaiter(this,void 0,void 0,function*(){let deleteQuery=`DELETE FROM ${component} WHERE id=$1`;try{let response=yield this.db.query(deleteQuery,id);return response}catch(err){console.error(err);return[]}})}deleteAll(component){return __awaiter(this,void 0,void 0,function*(){let deleteQuery=`TRUNCATE ${component} RESTART IDENTITY CASCADE`;try{let response=yield this.db.query(deleteQuery);return response}catch(err){console.error(err);return[]}})}dropTable(component){return __awaiter(this,void 0,void 0,function*(){let deleteAllQuery=`DROP TABLE IF EXISTS ${component}, ${component}_history`;try{let response=yield this.db.query(deleteAllQuery);return response}catch(err){console.error(err);return[]}})}getSingleHistoryRaw(component,id){return __awaiter(this,void 0,void 0,function*(){let getQuery=`SELECT * FROM ${component}_history WHERE foreignKey=$1`;try{let response=yield this.db.query(getQuery,id);return response}catch(err){return err}})}}const scribe=express();scribe.locals.argv=argv;if(argv.mode==="production"){mkdirp.sync(argv.home+"/cache/");mkdirp.sync(argv.home+"/logs/");scribe.use(require("express-bunyan-logger")({name:argv.name,streams:[{level:"error",stream:process.stderr},{level:"info",type:"rotating-file",path:argv.home+`/logs/${argv.name}.${process.pid}.json`,period:"1d",count:365}]}))}let db=new DB(postgresDb);scribe.post("/v0/:component/:subcomponent",parser.json(),(req,res,next)=>__awaiter(this,void 0,void 0,function*(){let componentSchema=yield db.getComponentSchema(`${req.params.component}/${req.params.subcomponent}`);if(componentSchema.validator(req.body)===false){res.status(400).send(componentSchema.validator.errors);return}db.createSingle(`${req.params.component}_${req.params.subcomponent}`,req.body,componentSchema.schema).then(result=>{res.send(result)})}));scribe.post("/v0/:component",parser.json(),(req,res,next)=>__awaiter(this,void 0,void 0,function*(){let componentSchema=yield db.getComponentSchema(req.params.component);if(componentSchema.validator(req.body)===false){res.status(400).send(componentSchema.validator.errors);return}db.createSingle(req.params.component,req.body,componentSchema.schema).then(result=>{res.send(result)})}));scribe.get("/v0/:component/:subcomponent/all",parser.urlencoded({extended:true}),(req,res,next)=>{db.getAll(`${req.params.component}_${req.params.subcomponent}`,req.query.filter).then(result=>{res.send(result)})});scribe.get("/v0/:component/all",parser.urlencoded({extended:true}),(req,res,next)=>{db.getAll(req.params.component,req.query.filter).then(result=>{res.send(result)})});scribe.get("/v0/:component/:subcomponent/all/history",parser.urlencoded({extended:true}),(req,res,next)=>{db.getAllHistory(`${req.params.component}_${req.params.subcomponent}`,req.query.filter).then(result=>{res.send(result)})});scribe.get("/v0/:component/all/history",parser.urlencoded({extended:true}),(req,res,next)=>{db.getAllHistory(req.params.component,req.query.filter).then(result=>{res.send(result)})});scribe.get("/v0/:component/:subcomponent/:id",parser.urlencoded({extended:true}),(req,res,next)=>{db.getSingle(`${req.params.component}_${req.params.subcomponent}`,req.params.id).then(result=>{res.send(result)})});scribe.get("/v0/:component/:id",parser.urlencoded({extended:true}),(req,res,next)=>{db.getSingle(req.params.component,req.params.id).then(result=>{res.send(result)})});scribe.get("/v0/:component/:subcomponent/:id/history",parser.urlencoded({extended:true}),(req,res,next)=>{db.getSingleHistory(`${req.params.component}_${req.params.subcomponent}`,req.params.id).then(result=>{res.send(result)})});scribe.get("/v0/:component/:id/history",parser.urlencoded({extended:true}),(req,res,next)=>{db.getSingleHistory(req.params.component,req.params.id).then(result=>{res.send(result)})});scribe.put("/v0/:component/:subcomponent/:id",parser.json(),(req,res,next)=>__awaiter(this,void 0,void 0,function*(){let componentSchema=yield db.getComponentSchema(`${req.params.component}/${req.params.subcomponent}`);if(componentSchema.validator(req.body)===false){res.status(400).send(componentSchema.validator.errors);return}db.updateSingle(`${req.params.component}_${req.params.subcomponent}`,req.params.id,req.body,componentSchema.schema).then(result=>{res.send(result)})}));scribe.put("/v0/:component/:id",parser.json(),(req,res,next)=>__awaiter(this,void 0,void 0,function*(){let componentSchema=yield db.getComponentSchema(req.params.component);if(componentSchema.validator(req.body)===false){res.status(400).send(componentSchema.validator.errors);return}db.updateSingle(req.params.component,req.params.id,req.body,componentSchema.schema).then(result=>{res.send(result)})}));scribe.delete("/v0/:component/:subcomponent/all",parser.urlencoded({extended:true}),(req,res,next)=>{db.deleteAll(`${req.params.component}_${req.params.subcomponent}`).then(result=>{res.send(result)})});scribe.delete("/v0/:component/all",parser.urlencoded({extended:true}),(req,res,next)=>{db.deleteAll(req.params.component).then(result=>{res.send(result)})});scribe.delete("/v0/:component/:subcomponent/:id",parser.urlencoded({extended:true}),(req,res,next)=>{db.deleteSingle(`${req.params.component}_${req.params.subcomponent}`,req.params.id).then(result=>{res.send(result)})});scribe.delete("/v0/:component/:id",parser.urlencoded({extended:true}),(req,res,next)=>{db.deleteSingle(req.params.component,req.params.id).then(result=>{res.send(result)})});scribe.delete("/v0/:component/:subcomponent",parser.urlencoded({extended:true}),(req,res,next)=>{if(parseInt(req.params.subcomponent)!==NaN){next();return}db.dropTable(`${req.params.component}_${req.params.subcomponent}`).then(result=>{res.send(result)})});scribe.delete("/v0/:component",parser.urlencoded({extended:true}),(req,res,next)=>{db.dropTable(req.params.component).then(result=>{res.send(result)});if(req.query.recursive){}});scribe.get("/v0",parser.urlencoded({extended:true}),(req,res,next)=>{res.statusCode=200;res.send()});scribe.all("*",(req,res,next)=>{res.status(400).send("Unhandled Route")});return scribe.listen(argv.port,()=>{console.log("Scribe - Process: %sd, Name: %s, Home: %s, Port: %d, Mode: %s, DB Name: %s",process.pid,argv.name,argv.home,argv.port,argv.mode,argv.dbName)})}exports.createServer=createServer;