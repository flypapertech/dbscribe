import { createServer, tryCreateDb } from "../src/scribe"
import * as chai from "chai"
import { expect, assert } from "chai"
import chaiHttp = require("chai-http")
import mocha = require("mocha");
import { Server } from "net";
import { DateTime } from "luxon"

chai.use(chaiHttp)

let baseEndPoint = "http://localhost:1337"
let server: Server

const schema = require(__dirname + "/../src/default.table.schema.json")
const now = DateTime.utc()
const created = now.minus({days: 1}).toISO()
const modified = now.toISO()


mocha.before(function(done: any) {
    tryCreateDb().then(() => {
        createServer(schema).then(scribeServer => {
            server = scribeServer
            done()
        }).catch(error => {
            done(error)
        })
    }).catch(error => {
        done(error)
    })
})

mocha.after(function(done: any) {
    server.close()
    done()
})

mocha.describe("Scribe", function() {
    mocha.it("Checks that server is running", function(done: any) {
        chai.request(baseEndPoint)
            .get("/")
            .end((err, res) => {
                assert.equal(res.status, 200)
                done()
            })
    })

    mocha.it("DEL component table", function(done: any) {
        chai.request(baseEndPoint)
            .del("/testComponent")
            .end((err, res) => {
                assert.equal(res.status, 200)
                expect(res.body).to.eql([])
                done()
            })
    })

    mocha.it("DEL subcomponent table", function(done: any) {
        chai.request(baseEndPoint)
            .del("/testComponent/sub")
            .end((err, res) => {
                assert.equal(res.status, 200)
                expect(res.body).to.eql([])
                done()
            })
    })

    mocha.it("POST to component", function(done: any) {
        let request = {
            "data": {
                "something": "somethingstring",
                "ids": [1, 3, 5]
            },
            "date_created": created,
            "date_modified": modified,
            "created_by": 2,
            "modified_by": 2
        }

        let expectedResponse = [
            {
                "id": 1,
                "data": {
                    "something": "somethingstring",
                    "ids": [1, 3, 5]
                },
                "date_created": created,
                "date_modified": modified,
                "created_by": 2,
                "modified_by": 2
            }
        ]

        chai.request(baseEndPoint)
            .post("/testComponent")
            .send(request)
            .end((err, res) => {
                assert.deepEqual(res.body, expectedResponse)
                done()
            })
    })

    mocha.it("GET all entries", function(done: any) {
        let expectedResponse = [
            {
                "id": 1,
                "data": {
                    "something": "somethingstring",
                    "ids": [1, 3, 5]
                },
                "date_created": created,
                "date_modified": modified,
                "created_by": 2,
                "modified_by": 2
            }
        ]
        chai.request(baseEndPoint)
            .get("/testComponent/all")
            .end((err, res) => {
                assert.deepEqual(res.body, expectedResponse)
                done()
            })
    })

    mocha.it("GET all entries with query filter", function(done: any) {
        let expectedResponse = [
            {
                "id": 1,
                "data": {
                    "something": "somethingstring",
                    "ids": [1, 3, 5]
                },
                "date_created": created,
                "date_modified": modified,
                "created_by": 2,
                "modified_by": 2
            }
        ]
        chai.request(baseEndPoint)
            .get("/testComponent/all")
            .query({filter: {"created_by": [2]}})
            .end((err, res) => {
                assert.deepEqual(res.body, expectedResponse)
                done()
            })
    })

    mocha.it("GET all entries with query filter2 is one of", function(done: any) {
        let expectedResponse = [
            {
                "id": 1,
                "data": {
                    "something": "somethingstring",
                    "ids": [1, 3, 5]
                },
                "date_created": created,
                "date_modified": modified,
                "created_by": 2,
                "modified_by": 2
            }
        ]
        chai.request(baseEndPoint)
            .get("/testComponent/all")
            .query({filter2: {"id": ["is one of", [1]]}})
            .end((err, res) => {
                assert.deepEqual(res.body, expectedResponse)
                done()
            })
    })

    mocha.it("GET all entries with query filter2 is one of nested", function(done: any) {
        let expectedResponse = [
            {
                "id": 1,
                "data": {
                    "something": "somethingstring",
                    "ids": [1, 3, 5]
                },
                "date_created": created,
                "date_modified": modified,
                "created_by": 2,
                "modified_by": 2
            }
        ]
        chai.request(baseEndPoint)
            .get("/testComponent/all")
            .query({filter2: {"data.something": ["is one of", "somethingstring"]}})
            .end((err, res) => {
                assert.deepEqual(res.body, expectedResponse)
                done()
            })
    })

    mocha.it("GET all entries with query filter2 contains", function(done: any) {
        let expectedResponse = [
            {
                "id": 1,
                "data": {
                    "something": "somethingstring",
                    "ids": [1, 3, 5]
                },
                "date_created": created,
                "date_modified": modified,
                "created_by": 2,
                "modified_by": 2
            }
        ]
        chai.request(baseEndPoint)
            .get("/testComponent/all")
            .query({filter2: {"data.ids": ["contains", [3]]}})
            .end((err, res) => {
                assert.deepEqual(res.body, expectedResponse)
                done()
            })
    })

    mocha.it("GET all entries with query filter expect none", function(done: any) {
        let expectedResponse:any[] = []
        chai.request(baseEndPoint)
            .get("/testComponent/all")
            .send({filter: {"created_by": [3]}})
            .end((err, res) => {
                assert.deepEqual(res.body, expectedResponse)
                done()
            })
    })

    mocha.it("GET all entries with body filter", function(done: any) {
        let expectedResponse = [
            {
                "id": 1,
                "data": {
                    "something": "somethingstring",
                    "ids": [1, 3, 5]
                },
                "date_created": created,
                "date_modified": modified,
                "created_by": 2,
                "modified_by": 2
            }
        ]
        chai.request(baseEndPoint)
            .get("/testComponent/all")
            .send({filter: {"created_by": [2]}})
            .end((err, res) => {
                assert.deepEqual(res.body, expectedResponse)
                done()
            })
    })

    mocha.it("GET all entries with body filter nested", function(done: any) {
        let expectedResponse = [
            {
                "id": 1,
                "data": {
                    "something": "somethingstring",
                    "ids": [1, 3, 5]
                },
                "date_created": created,
                "date_modified": modified,
                "created_by": 2,
                "modified_by": 2
            }
        ]
        chai.request(baseEndPoint)
            .get("/testComponent/all")
            .send({filter: {"data.something": "somethingstring"}})
            .end((err, res) => {
                assert.deepEqual(res.body, expectedResponse)
                done()
            })
    })

    mocha.it("GET all entries with body filter expect none", function(done: any) {
        let expectedResponse:any[] = []
        chai.request(baseEndPoint)
            .get("/testComponent/all")
            .query({filter: {"created_by": [3]}})
            .end((err, res) => {
                assert.deepEqual(res.body, expectedResponse)
                done()
            })
    })

    mocha.it("GET from table that doesn't exist should return empty array", function(done: any) {
        const expectedResponse: any[] = []
        chai.request(baseEndPoint)
            .get("/someTableThatDoesntExist/all")
            .end((err, res) => {
                assert.deepEqual(res.body, expectedResponse)
                done()
            })
    })

    mocha.it("PUT entry", function(done: any) {
        let request = {
            "data": {
                "something": "we changed this",
                "ids": [1, 3, 5],
                "data2": "new thing"
            },
            "date_created": created,
            "date_modified": modified,
            "created_by": 2,
            "modified_by": 2
        }

        let expectedResponse = [
            {
                "id": 1,
                "data": {
                    "something": "we changed this",
                    "ids": [1, 3, 5],
                    "data2": "new thing"
                },
                "date_created": created,
                "date_modified": modified,
                "created_by": 2,
                "modified_by": 2
            }
        ]

        chai.request(baseEndPoint)
            .put("/testComponent/1")
            .send(request)
            .end((err, res) => {
                assert.deepEqual(res.body, expectedResponse)
                done()
        })
    })


    mocha.it("PUT with schema change", function(done: any) {
        server.close(async () =>  {
            let newSchema = schema
            newSchema.required.push("new_column")
            newSchema.properties["new_column"] = {
                "type": "string"
            }

            server = await createServer(newSchema)
            let request = {
                "data": {
                    "something": "somethingstring",
                    "ids": [1, 3, 5]
                },
                "date_created": created,
                "date_modified": modified,
                "created_by": 2,
                "modified_by": 2,
                "new_column": "woot"
            }
            let expectedResponse = [
                {
                    "id": 1,
                    "data": {
                        "something": "somethingstring",
                        "ids": [1, 3, 5]
                    },
                    "date_created": created,
                    "date_modified": modified,
                    "created_by": 2,
                    "modified_by": 2,
                    "new_column": "\"woot\""
                }
            ]

            chai.request(baseEndPoint)
                .put("/testComponent/1")
                .send(request)
                .end((err, res) => {
                    assert.deepEqual(res.body, expectedResponse)
                    done()
            })
        })
    })
})
