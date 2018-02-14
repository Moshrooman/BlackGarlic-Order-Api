var express = require("express");
var app = express();

var port = 3000;

var bodyParser = require("body-parser");

var mysql = require("mysql");

var jsonParser = bodyParser.json();

var Slack = require('slack-node');

var Promise = require("promise");

var request = require("request");

var moment = require("moment");

var sendgrid = require('sendgrid')('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');

var gcm = require("node-gcm");

var glob = require("glob");

var CronJob = require("cron").CronJob;

app.use(jsonParser);

var pool = mysql.createPool({
    connectionLimit: 100,
    host: 'IP',
    user: 'USER',
    password: 'PASSWORD',
    database: 'DATABASE',
    dateStrings: true,
    debug: false
});

var poolMusic = mysql.createPool({

    connectionLimit: 100,
    host: 'IP',
    user: 'USER',
    password: 'PASSWORD',
    database: 'DATABASE',
    dateStrings: true,
    debug: false

});

var music = require("./music.js");
music.uploadMusic(CronJob, glob, poolMusic);

app.post("/app/login", jsonParser, function(req, res) {

    var email = req.body.email;
    var password = req.body.password;

    var data = {};

    var customerQuery = "select customer_status, customer_email, customer_password, customer_id, first_name, last_name FROM customer where customer_email = '" + email + "' and customer_password = '" + password + "';";

    pool.getConnection(function(err, con) {

	if(!err) {

        con.query(customerQuery, function(err, result) {

            if (err) {
                res.send("Invalid Username/Password");
            } else {

                data.customer_name = result[0].first_name + " " + result[0].last_name;
                data.customer_id = result[0].customer_id;
		data.customer_status = result[0].customer_status;
		data.customer_email = result[0].customer_email;
                con.query("select address_id, address_content, city, mobile, zipcode, address_notes FROM customer_address where customer_id = '" + data.customer_id + "';", function(err, result) {

                    if (result.length == 0) {
                        data.address_id = "-1";

                        res.send(JSON.stringify(data));

                        con.release();

                    } else {
                        data.address_id = result[0].address_id;
                        data.address_content = result[0].address_content;
                        data.city = result[0].city;
                        data.mobile = result[0].mobile;
                        data.zipcode = result[0].zipcode;
                        data.address_notes = result[0].address_notes;

                        res.send(JSON.stringify(data));

                        con.release();

                    }

                });

            }

        });

    } else {

	throw err;

    }

    });

});

app.get("/app/menu/:date", function(req, res) {

    //Date in the format of YYYY-MM-DD
    var date = req.params.date;

    pool.getConnection(function(err, con) {

	if(!err) {

        con.query("select box_id from box where (box_start <= '" + date + "') and ('" + date + "' <= box_end);", function(err, result) {

            var data = {

                box_ids: [],
                menu_ids: [],
                menus: [],

            };

            if (err) {
                throw err;
            } else {

		if(result.length == 0) {

		    res.send("empty");

		}

                for (var i = 0; i < result.length; i++) {
                    data.box_ids.push(result[i].box_id);
                }

                con.query("select menu_id from box_menu where box_id IN (" + data.box_ids.toString() + ")", function(err, result) {

                    if (err) {
                        throw err;
                    } else {

                        for (var k = 0; k < result.length; k++) {
                            data.menu_ids.push(result[k].menu_id);
                        }
                    }

                    con.query("select menu_name, menu_subname, menu_description, menu_type from menu where menu_id IN (" + data.menu_ids.toString() + ");", function(err, result) {

                        if (err) {
                            throw err;
                        } else {

                            data.menus.push.apply(data.menus, result);

                            res.send(JSON.stringify(data));

                            con.release();

                        }

                    });

                });

            }

        });

    } else {

	throw err;

    }

    });

});

app.post("/app/createaccount", function(req, res) {

    var data = {

        first_name: req.body.first_name,
        last_name: req.body.last_name,
        customer_email: req.body.customer_email,
        customer_password: req.body.customer_password,
        customer_status: "0",
        birthday: req.body.birthday,
        customer_code: "0",
        balance: "0",
        referrer_count: "0",
	profile_picture: "",
	favorites: ""

    };

    pool.getConnection(function(err, con) {

	if(!err) {

        var q = "INSERT INTO customer SET ?";

        con.query(q, data, function(err, result) {

	    console.log(result);

            if (!err) {
                res.send("Successful");
                con.release();
            } else if (err.code === "ER_DUP_ENTRY") {
                res.send("Duplicate");
                con.release();
            } else {

		throw err;

	    }

        });

	} else {
	    throw err;
	}

    });

});

app.post("/app/updateaccount", function(req, res) {

    var data = {

        address_id: req.body.address_id,
        customer_id: req.body.customer_id,
        address_content: req.body.address_content,
        city: req.body.city,
        mobile: req.body.mobile,
        zipcode: req.body.zipcode,
        address_notes: req.body.address_notes,
        address_status: "1"

    }

    pool.getConnection(function(err, con) {

	if(!err) {

        if (data.address_id == "-1") {

            var sendData = {

                customer_id: req.body.customer_id,
                address_content: req.body.address_content,
                city: req.body.city,
                mobile: req.body.mobile,
                zipcode: req.body.zipcode,
                address_notes: req.body.address_notes,
                address_status: "1"

            }

            var firstq = "INSERT INTO customer_address SET ?";

            con.query(firstq, sendData, function(err, result) {

                if (err) {
                    throw err;
                } else {
                    res.send("Successfully Added");
                    con.release();
                }

            });

        } else {

            var secondq = "UPDATE customer_address SET ? WHERE customer_id = '" + data.customer_id + "';";

            con.query(secondq, data, function(err, result) {

                if (err) {
                    throw err;
                } else {
                    res.send("Succesfully Updated");
                    con.release();
                }

            });

        }

	} else {

	    throw err;

	}

    });

});

app.post("/app/order", function(req, res) {

	var voucher_id_global = req.body.voucher_id; //This is the voucher id because we need to check if voucher_discount is not 0 and if it isn't then we have to query into order_discount

    //First Query Data, Inserting This Into Database order
    var firstQueryData = {

        //Automatically Generated 1st Query Variables
        unique_id: Math.floor(Math.random() * 900000) + 100000,
        order_status: 0,
        payment_status: 0,

        //Taken from the req.body
        order_source: req.body.order_source, //Make this one "app"
        customer_id: req.body.customer_id,
        box_id: req.body.box_id, //Don't include the referral box, take it away in android app
        order_date: req.body.order_date, //Delivery date, date that box will be sent
        payment_method: req.body.payment_method, //For Now Can Only Be Bank Transfer
        balance_discount: "-" + req.body.balance_discount, //In App Just Make 0, We Will Implement Later
        voucher_discount: req.body.voucher_discount, //In App Just Make 0 Also, We Will Implement Later
        delivery_fee: req.body.delivery_fee,
        grandtotal: req.body.grandtotal,

    }

    pool.getConnection(function(err, con) {

	if(!err) {

        var secondQueryData;

        var firstQuery = function() {

            return new Promise(function(resolve, reject) {

                var q = "INSERT INTO `order` SET ?";

                con.query(q, firstQueryData, function(err, result) {

                    if (!err) {

                        //Second Query Data (into Order_address)
                        resolve(
                            secondQueryData = {
                                order_id: result.insertId,
                                customer_name: req.body.address.customer_name, //Concetanate first and last name
                                mobile: req.body.address.mobile,
                                address_content: req.body.address.address_content,
                                city: req.body.address.city, //In Number, Not Actual City
                                zipcode: req.body.address.zipcode,
                                address_notes: req.body.address.address_notes,
                                delivery_time: req.body.address.delivery_time, //This will change for etobee and gojek       
                            });

                    }

                });

            });

        }

        var secondQuery = function() {

            return new Promise(function(resolve, reject) {

                con.query("INSERT INTO order_address SET ?", secondQueryData, function(err, result) {

                    if (!err) {
                        resolve("DONE");
                    }

                });

                console.log(firstQueryData.unique_id);

            })

        }

        var thirdQuery = function(menus, i, stoppoint) {
            //Third Query (into order_menu)

            return new Promise(function(resolve, reject) {

                con.query("INSERT INTO order_menu SET ?", menus, function(err, result) {

                    if (!err) {

                        if (i == stoppoint) {

                            res.send(firstQueryData.unique_id.toString());

                            request({

                                url: 'http://188.166.221.241:3000/orderextension',
                                method: 'POST',

                                json: {
                                    unique_id: firstQueryData.unique_id
                                }

                            }, function(err, response, body) {
                                if (!err) {

                                }

                            })


				console.log(firstQueryData.voucher_discount);
				console.log(voucher_id_global);

				if(firstQueryData.voucher_discount != 0) {

				var lastQueryData = {

				    order_id: secondQueryData.order_id,
				    voucher_id: voucher_id_global,

				}

				con.query("insert into order_discount set ?", lastQueryData, function(err, result) {

				    if(!err) {

					con.release();

				    } else {

					con.release();
					throw err;

				    }

				});

				} else {

				    con.release();

				}

                            resolve("DONE");

                        }

                    }

                });

            });

        }

        firstQuery().then(function() {
            secondQuery().then(function() {

                var menu = req.body.menu;

                for (var i = 0; i < menu.length; i++) {
                    var menus = {
                        order_id: secondQueryData.order_id,
                        menu_id: menu[i].menu_id,
                        portion: menu[i].portion
                    }

                    thirdQuery(menus, i, menu.length - 1);

                }

            })

        });

	} else {

	    throw err;

	}

    });

});

app.post("/app/paymentconfirmation", function(req, res) {

    var apiToken = "xoxp-3512371997-6086264097-28815276167-7fc53b0ddd";

    var slack = new Slack(apiToken);

    var email = req.body.email;
    var bank = req.body.bank;
    var rekening = req.body.rekening;
    var customer_name = req.body.customer_name;
    var order_id = req.body.order_id;

    slack.api('chat.postMessage', {
        text: "APP Payment Confirmation: " + email + " dari bank " + bank + " No: " + rekening + " a/n " + customer_name + " untuk order " + order_id + "",
        channel: "@justinkwik",
        username: "WorkerBot"
    }, function(err, response) {
        if (err) {
            res.send("Unsuccessful");
            throw err;
        } else {
            res.send("Successful");
        }
    });

});

app.post("/app/orderhistory", function(req, res) {

    var orders = [];

    var customer_id = req.body.customer_id;

    console.log("Customer Id: " + customer_id);

    pool.getConnection(function(err, con) {

	if(!err) {

        var q = "SELECT `order`.order_id, `order`.unique_id, `order`.grandtotal, `order`.payment_status, `order`.order_status, `order`.order_date, `order`.added, order_address.address_content, order_address.mobile FROM `order` INNER JOIN order_address on customer_id = " + customer_id + " and `order`.order_id = order_address.order_id ORDER BY added DESC";

        con.query(q, function(err, result) {
            if (err) {
                throw err;
            } else {

                for (var i = 0; i < result.length; i++) {

                    var data = {
                        order_id: result[i].order_id,
                        unique_id: result[i].unique_id,
                        grandtotal: result[i].grandtotal,
                        payment_status: result[i].payment_status,
                        order_status: result[i].order_status,
                        order_date: result[i].order_date,
                        added: result[i].added,

                        menus: [],

                        address_content: result[i].address_content,
                        mobile: result[i].mobile
                    }

                    orders.push(data);
                }

                //Here is where the promise starts to add the stuff into the empty menus array, explanation is below.

                var getThirdQuery = (function(order_id, position) {

                    return new Promise(function(resolve, reject) {

                        //The query statement joins both databases `menu` and order_menu to take portion and menu_id from order_menu using the order_id, and using the menu_id that it returns to take the menu_name and menu_type from `menu`. 

                        //After the on is the primary key that we use, so the key that we use in order to get the portion and menu_id from the order_menu table, which we are using order_id.

                        //Then after the and is the second key that we are going to use, so we are using the menu_id that was returned in order to get the values from the menu table.
                        var q3 = "SELECT order_menu.portion, order_menu.menu_id, `menu`.menu_name, `menu`.menu_type FROM order_menu INNER JOIN `menu` on order_menu.order_id = " + order_id + " and `menu`.menu_id = order_menu.menu_id";

                        con.query(q3, function(err, result) {

                            if (err) {
                                throw err;
                            } else {
                                resolve(
                                    orders[position].menus.push.apply(orders[position].menus, result)
                                );

                                if (position == orders.length - 1) {

                                    //So basically this is just a function that returns a promise, so this function is not invoked instantly so the promise isn't returned instantly, however the for loop right outside of this is where this function is called 5 times and where this comment is, is where we have caught when the for loop is at its end.

                                    //Because the position was passed as a parameter in the for loop outside of here, we can check if the position is equal to the orders.length-1, which means that it is at the end of the index, so we continue the rest of the code here.

                                    res.send(JSON.stringify(orders));
                                    con.release();

                                }


                            }

                        });

                    }, 0);

                });

                for (var i = 0; i < orders.length; i++) {

                    var order_id = orders[i].order_id;

                    getThirdQuery(order_id, i).then(function(object) {

                    });

                }


            }
        });

	} else {

	    throw err;

	}

    });

    //This first query is much like the second, so first it takes the order_id, unique_id, grandtotal, payment_status, order_status, order_date and added from the `order` table. However, I also want to retrieve the address_content and the mobile from the order_address table. So I say from `order` while inner joining the table order_address where the initial key is the customer_id that is taken from the body, and the second key is we want to use the order_id that is retrieved and match it with the order_id in the order_address. Then we sort order it by added in a descending fashion and we limit it to 5 to take the last 5 entries.

});

app.post("/orderextension", function(req, res) {

    var unique_id = req.body.unique_id;

    var apiToken = "xoxp-3512371997-6086264097-28815276167-7fc53b0ddd";

    var slack = new Slack(apiToken);

    // var client = new Intercom.Client("def0fyyg", "cc077cae04c7b47f9fa700daab7bca1c04207f3c");

    var slackData = {

        unique_id: unique_id,

        dataArray: []

    };

    Number.prototype.formatMoney = function(decPlaces, thouSeparator, decSeparator) {
        var n = this,
            decPlaces = isNaN(decPlaces = Math.abs(decPlaces)) ? 2 : decPlaces,
            decSeparator = decSeparator == undefined ? "." : decSeparator,
            thouSeparator = thouSeparator == undefined ? "," : thouSeparator,
            sign = n < 0 ? "-" : "",
            i = parseInt(n = Math.abs(+n || 0).toFixed(decPlaces)) + "",
            j = (j = i.length) > 3 ? j % 3 : 0;
        return sign + (j ? i.substr(0, j) + thouSeparator : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + thouSeparator) + (decPlaces ? decSeparator + Math.abs(n - i).toFixed(decPlaces).slice(2) : "");
    };


    pool.getConnection(function(err, con) {

	if(!err) {

        //Send message to slack
        // - After creating this, in the order api have to delete where it takes the breakfast and original portions, delivery, keep delivery fee and grandtotal
        // - And instead send a post request with the UNIQUE ID, take away all format numbers and requiring breakfast and original in the req.body.
        // - Need to nmp install request in the slack api

        //Send event to intercom
        // - Need to npm install and require intercom-client
        // - Need to nmp install and require moment

        //Send grid email.


        //Start of Main Query code, in the else it will send message to slack, intercom, and sendgrid

        var test = "SELECT `order`.order_id, `order`.order_date, `order`.voucher_discount, `order`.order_source, `order`.payment_method, `order`.customer_id, `order`.customer_id, `order`.delivery_fee, `order`.grandtotal, order_menu.menu_id, order_menu.portion, `menu`.menu_type, `menu`.menu_name, `customer`.customer_email, order_address.delivery_time, order_address.customer_name, order_address.address_content, order_address.city, order_address.city, order_address.mobile, order_address.address_notes FROM `order` INNER JOIN order_menu ON `order`.unique_id = " + unique_id + " and order_menu.order_id = `order`.order_id INNER JOIN `menu` ON `menu`.menu_id = order_menu.menu_id INNER JOIN `customer` ON `customer`.customer_id = `order`.customer_id INNER JOIN order_address ON order_address.order_id = `order`.order_id";

        con.query(test, function(err, result) {
            if (err) {

                throw err;

            } else {

                slackData.dataArray.push.apply(slackData.dataArray, result);

                con.release();

                var htmlCode = "";

                var originalTwoPerson = 0;
                var originalFourPerson = 0;

                var breakfastTwoPerson = 0;
                var breakfastFourPerson = 0;

                var kidsTwoPerson = 0;

                var subTotal = 0;

                for (var i = 0; i < slackData.dataArray.length; i++) {
                    if (((slackData.dataArray[i].menu_type == "3") || (slackData.dataArray[i].menu_type == "5")) && (slackData.dataArray[i].portion == "2")) {
                        originalTwoPerson++;
                        subTotal = subTotal + 100000;
                        htmlCode = htmlCode + "<tr><td>1</td><td>" + slackData.dataArray[i].menu_name + " (2P)</td><td>100,000</td></tr>";
                    } else if (((slackData.dataArray[i].menu_type == "3") || (slackData.dataArray[i].menu_type == "5")) && (slackData.dataArray[i].portion == "4")) {
                        originalFourPerson++;
                        subTotal = subTotal + 150000;
                        htmlCode = htmlCode + "<tr><td>1</td><td>" + slackData.dataArray[i].menu_name + " (4P)</td><td>150,000</td></tr>";
                    } else if (((slackData.dataArray[i].menu_type == "4") || (slackData.dataArray[i].menu_type == "6")) && (slackData.dataArray[i].portion == "2")) {
                        breakfastTwoPerson++;
                        subTotal = subTotal + 80000;
                        htmlCode = htmlCode + "<tr><td>1</td><td>" + slackData.dataArray[i].menu_name + " (2P)</td><td>80,000</td></tr>";
                    } else if (((slackData.dataArray[i].menu_type == "4") || (slackData.dataArray[i].menu_type == "6")) && (slackData.dataArray[i].portion == "4")) {
                        breakfastFourPerson++;
                        subTotal = subTotal + 140000;
                        htmlCode = htmlCode + "<tr><td>1</td><td>" + slackData.dataArray[i].menu_name + " (4P)</td><td>140,000</td></tr>";
                    } else if (((slackData.dataArray[i].menu_type == "7")) && (slackData.dataArray[i].portion == "2")) {
                        kidsTwoPerson++;
                        subTotal = subTotal + 90000;
                        htmlCode = htmlCode + "<tr><td>1</td><td>" + slackData.dataArray[i].menu_name + " (2P)</td><td>90,000</td></tr>";
                    }
                }

                //Start of code to send message to slack

                slack.api('chat.postMessage', {
                    text: "New " + slackData.dataArray[0].order_source.toUpperCase() + " Order: " + slackData.dataArray[0].customer_email + " -> " + slackData.dataArray.length + " items = \n\n " + "Breakfast:\n" + "Two Person: " + breakfastTwoPerson + "\n" + "Four Person: " + breakfastFourPerson + "\n\n" + "Original:\n" + "Two Person: " + originalTwoPerson + "\n" + "Four Person: " + originalFourPerson + "\n\n" + "Kids:\n" + "Two Person: " + kidsTwoPerson + "\n\n Delivery Fee " + slackData.dataArray[0].delivery_fee.formatMoney(0, ',', '') + " --> " + slackData.dataArray[0].grandtotal.formatMoney(0, ',', '') + "",
                    channel: "@justinkwik",
                    username: "OrderBot"
                }, function(err, response) {


                });

                //End of code to send message to slack


                //Start of code to send event to intercom

                // var momentDate = moment().utcOffset(420).valueOf();

                // client.events.create({

                //     event_name: 'purchase_box',
                //     created_at: moment(momentDate).unix(),
                //     email: slackData.dataArray[0].customer_email,

                //     metadata: {

                //         ORDER_SOURCE: slackData.dataArray[0].order_source,
                //         PAYMENT_METHOD: slackData.dataArray[0].payment_method,
                //         TYPE: "retail",
                //         ORDER_ID: slackData.unique_id

                //     }

                // }, function (d) {

                // });

                //End of code to send event to intercom



                // Start of code to send email using send grid.


                var date = moment(slackData.dataArray[0].order_date);

                var dayOfWeek = date.format('dddd');
                var dayOfMonth = date.format('M');
                var monthOfYear = date.format('MMM');
                var year = date.format('YYYY');

                var deliveryType = "";

                if (slackData.dataArray[0].delivery_fee == 20000) {
                    deliveryType = "GO-JEK (" + slackData.dataArray[0].delivery_time + ":00)";
                } else {
                    deliveryType = "Etobee ( 12:00 - 19:00 )";
                }

                var city = "";

                if (slackData.dataArray[0].city == 1) {
                    city = "Jakarta Pusat";
                } else if (slackData.dataArray[0].city == 2) {
                    city = "Jakarta Selatan";
                } else if (slackData.dataArray[0].city == 3) {
                    city = "Jakarta Barat";
                } else if (slackData.dataArray[0].city == 4) {
                    city = "Jakarta Utara";
                } else if (slackData.dataArray[0].city == 5) {
                    city = "Jakarta Timur";
                } else if (slackData.dataArray[0].city == 6) {
                    city = "Tangerang";
                } else if (slackData.dataArray[0].city == 7) {
                    city = "Bekasi";
                } else if (slackData.dataArray[0].city == 8) {
                    city = "Tangerang Selatan";
                } else if (slackData.dataArray[0].city == 9) {
                    city = "Depok";
                }


                var email = new sendgrid.Email();

                email.addTo(slackData.dataArray[0].customer_email);
                email.subject = "BlackGarlic.id: Order #" + slackData.unique_id + "";
                email.from = 'donotreply@blackgarlic.id';
                email.fromname = 'BlackGarlic Support';
                email.replyto = "cs@blackgarlic.id";
                email.html = " ";

                email.setFilters({
                    'templates': {
                        'settings': {
                            'enable': 1,
                            'template_id': '1a384097-e65a-416b-b963-51c5ee414822',
                        }
                    }
                });

                email.addSubstitution('order_id', slackData.unique_id);
                email.addSubstitution('deliverToName', slackData.dataArray[0].customer_name);
                email.addSubstitution('deliverToAddressContent', slackData.dataArray[0].address_content);
                email.addSubstitution('deliverToCity', city);
                email.addSubstitution('deliverToMobile', slackData.dataArray[0].mobile);

                email.addSubstitution('deliveryInstruction', slackData.dataArray[0].address_notes);

                email.addSubstitution('subTotal', subTotal.formatMoney(0, ',', ''));
                email.addSubstitution('deliveryFee', slackData.dataArray[0].delivery_fee.formatMoney(0, ',', ''));
                email.addSubstitution('grandTotal', slackData.dataArray[0].grandtotal.formatMoney(0, ',', ''));
                email.addSubstitution('promoCode', slackData.dataArray[0].voucher_discount);

                email.addSubstitution('deliveryDate', dayOfWeek + ", " + dayOfMonth + " " + monthOfYear + " " + year);

                email.addSubstitution('shippingOption', deliveryType);

                //Inside of the existing table, I added a <tbody>orderrow</tbody> and replaced the orderrow. This is because <tr> has to have a <tbody> as its parent.
                email.addSubstitution('orderrow', htmlCode);



                // sendgrid.send(email, function(err, json) {

                //     if (err) {
                //         throw err;
                //     } else {
                //     }

                // });


                //End of code to send email using send grid.

            }
        });

	} else {

	    throw err;

	}

    });

    //End of mainQuery code

});

app.post("/app/pushorderhistory", function(req, res) {

    res.send("OK");

    var unique_id = req.body.unique_id;
    var regToken = req.body.regToken;
    var regTokenArray = [regToken];

    var message = new gcm.Message({
        priority: 'high',
        data: {
            message: "For Order Id: " + unique_id + ""
        }

    });

    var sender = new gcm.Sender("AIzaSyCYSIDogEPWHFAByJ74XQdN8-6FdxnVLQE");

    pool.getConnection(function(err, con) {

	if(!err) {

        var query = "SELECT order_status, payment_status from `order` where unique_id = " + unique_id + "";

        var checkForPaymentStatus = function() {
            con.query(query, function(err, result) {

                if (!err) {
                    console.log(result[0].payment_status);

                    if (result[0].order_status == -1) {
                        return;
                    } else if (result[0].payment_status != 1) {
                        rerunquery();
                    } else {
                        sender.send(message, { registrationTokens: regTokenArray }, function(err, response) {
                            if (err) {
                                throw err;
                            } else {
                                console.log(response);
                            }
                        });
                        con.release();
                    }
                } else {
                    throw err;
                }


            });
        }

        var rerunquery = function() {
            setTimeout(checkForPaymentStatus, 1000);
        }

        checkForPaymentStatus();

	} else {

	    throw err;

	}

    });

});

app.post("/app/voucher", function(req, res) {

    var voucher_code = req.body.voucher_code;
    var subtotal = req.body.subtotal;

    pool.getConnection(function(err, con) {

	if(!err) {

	    var query = "SELECT * FROM voucher WHERE voucher_name = '" + voucher_code + "'";

	    con.query(query, function(err, result) {

		console.log(JSON.stringify(result));

		if(!err) {

		    if (result.length == 0) {

			res.send("invalid");

		    } else {

			if(result[0].voucher_status == 0) {

			    res.send("expired");

			} else if(result[0].voucher_min > subtotal) {

			    res.send("voucher_min: "+result[0].voucher_min.toString()+"");

			} else {

			    var voucherValue = result[0].voucher_value.toString();
			    var voucherId = result[0].voucher_id.toString();

			    var dataToSend = {

				voucher_value: voucherValue,
				voucher_id: voucherId

			    }

			    console.log(JSON.stringify(dataToSend));
			    res.send(JSON.stringify(dataToSend));

			}

		    }

		} else {

		    throw err;

		}

		});

	} else {

	    throw err;

	}

    })

});

app.post("/app/checkprofilepicture", function(req, res) {

    var customer_id = req.body.customer_id;
    console.log(customer_id);

    pool.getConnection(function(err, con){

	if(!err) {

	    var query = "SELECT profile_picture from customer where customer_id = '"+ customer_id +"'";

	    con.query(query, function(err, result){

		if(err) {

		    throw err;

		} else {

		    if(result[0].profile_picture == "") {

			res.send("empty");
			con.release();

		    } else {

			res.send(result[0].profile_picture);
			con.release();

		    }

		}

	    });

	} else {

	    throw err;
	    con.release();

	}

    });

});

app.post("/app/uploadprofilepicture", function(req, res) {

    var profile_picture = req.body.profile_picture;
    var customer_id = req.body.customer_id;

    var queryStatement = "UPDATE `customer` SET profile_picture = '"+ profile_picture +"' WHERE customer_id = '"+ customer_id +"'";

    pool.getConnection(function(err, con) {

	if(!err) {

	    con.query(queryStatement, function(err, result) {

		if(!err) {

		    res.send(profile_picture);

		} else {

		    throw err;

		}

	    });

	} else {

	    throw err;

	}


    });

});

app.post("/app/cookbook", function(req, res) {

    //Don't need anything because it'll always just return the full cookbook.

    var data = [];

    pool.getConnection(function(err, con) {

	if(!err) {

	    var firstQuery = function() {

		return new Promise(function(resolve, reject) {

		    var query = "SELECT * FROM `menu` INNER JOIN box_menu ON box_menu.menu_id = `menu`.menu_id";

		    con.query(query, function(err, result) {

			if(!err) {

			    var result_to_edit = [];

			    result_to_edit.push.apply(result_to_edit, result);

			    for(var i = 0; i < result_to_edit.length; i++) {

				var steps = [];

				var ingredients = [];

				result_to_edit[i].steps = steps;

				result_to_edit[i].ingredients = ingredients;

			    }

			    resolve(data.push.apply(data, result_to_edit));

			} else {

			    throw err;

			}

		    })

		});

	    };

	    var secondQuery = function(queryStatement, i, stoppoint) {

		return new Promise(function(resolve, reject) {

		    con.query(queryStatement, function(err, result) {

			if(!err) {

			    resolve(data[i].steps.push.apply(data[i].steps, result));

			}

		    });

		})

	    }

	var thirdQuery = function(queryStatement, i, stoppoint) {

	    return new Promise(function(resolve, reject) {

		con.query(queryStatement, function(err, result) {

		    if(!err) {

			resolve(data[i].ingredients.push.apply(data[i].ingredients, result));

			if(i == stoppoint) {

			    res.send(JSON.stringify(data));

			    con.release();

			}

		    }

		});

	    });

	}

	    firstQuery().then(function(){

		for(var i = 0; i < data.length; i++) {

		    var menu_id = data[i].menu_id;

		    var query = "SELECT * FROM `recipe` where menu_id = '"+ menu_id +"'";

		    secondQuery(query, i, data.length - 1);

		}

	    }).then(function() {

		for(var i = 0; i < data.length; i++) {

		    var menu_id = data[i].menu_id;

		    var queryStatement2 = "SELECT menu_ingredient.ingredient_id, `ingredient`.ingredient_name from menu_ingredient INNER JOIN `ingredient` ON menu_id = '"+ menu_id +"' AND menu_ingredient.ingredient_id = `ingredient`.ingredient_id";

		    thirdQuery(queryStatement2, i, data.length - 1);

		}

	    });

	}

    });

});

app.post("/app/getfavorites", function(req, res) {

    var customer_id = req.body.customer_id;

    var querystatement = "SELECT favorites FROM `customer` where customer_id = '"+ customer_id +"'";

    var favorites_array = [];

    pool.getConnection(function(err, con) {

	if(!err) {

	    con.query(querystatement, function(err, result) {

		if(!err) {

		    if(result[0].favorites == ""){

			res.send("empty");
			con.release();

		    } else {

			favorites_array = result[0].favorites.split(",");
			res.send(JSON.stringify(favorites_array));
			con.release();

		    }

		} else {

		    throw err;
		    con.release();

		}

	    });

	} else {

	    throw err;

	}

    })

});

app.post("/app/insertordeletefavorite", function(req, res) {

    var customer_id = req.body.customer_id;
    var menu_name = req.body.menu_name;
    console.log(menu_name);
    var resultArray = [];
    var contained = false;

    pool.getConnection(function(err, con) {

	if (!err){

	    var firstQuery = function() {

		return new Promise(function(resolve, reject) {

		    var query = "SELECT favorites from `customer` where customer_id = '"+ customer_id +"'";

		    con.query(query, function(err, result) {

			if(!err) {

			    if(result[0].favorites == "") {

				resolve(resultArray = []);
				resolve(contained = false);

			    } else if(result[0].favorites.indexOf(menu_name) != -1) {

				resolve(resultArray = result[0].favorites.split(","));
				resolve(contained = true);

			    } else {

				resolve(resultArray = result[0].favorites.split(","));
				resolve(contained = false);

			    }

			} else {

			    throw err;

			}

		    })

		})

	    }

	    var secondQuery = function() {

		return new Promise(function(resolve, reject) {

		    if(contained == true) {

			console.log(contained.toString() + ": Deleting");

			//since contained is true then we want to find the element inside the array that has the string of the menu name and delete it, then when we update, we just call the
			//array.toString and it will be separated by commas

			for(var i = 0; i < resultArray.length; i++) {

			    if(resultArray[i].indexOf(menu_name) != -1) {

				resultArray.splice(i, 1);
				break;

			    }

			}

			console.log("After: " + JSON.stringify(resultArray));

			var secondQueryStatement = "UPDATE `customer` SET favorites = '"+ resultArray.toString() +"' where customer_id = '"+ customer_id +"'";
			console.log("Second Query Statement: " + secondQueryStatement);

			con.query(secondQueryStatement, function(err, result) {

			    if(!err) {

				res.send("removed");
				con.release();

			    } else {

				throw err;
				con.release();

			    }

			});

		    } else {

			console.log(contained.toString() + ": Adding");

			resultArray.push(menu_name);
			console.log("After: " + JSON.stringify(resultArray));

			var secondQueryStatement = "UPDATE `customer` SET favorites = '"+ resultArray.toString() +"' where customer_id = '"+ customer_id +"'";
			console.log("Second Query Statement: " + secondQueryStatement);

			con.query(secondQueryStatement, function(err, result) {

			    if(!err) {

				res.send("added");
				con.release();

			    } else {

				throw err;
				con.release();


			    }

			});

		    }

		})

	    }

	    firstQuery().then(function(){

		console.log("Before: "+ JSON.stringify(resultArray));

		secondQuery();

	    });

	} else {

	    throw err;

	}
    })

});

app.post("/app/setupreferral", function(req, res) {

	var letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	var referralCode = "";
	var foundEmail = false;
	var foundEmailRefer = false;
	var referralCountBoolean = false;
	var lastReferral = false;
	var timeLeft = 0;

	for(var i = 0; i < 5; i++) {

	    var randomNumber = Math.random();

	    if(randomNumber <= 0.5 ){

		referralCode = referralCode + letters.charAt(Math.floor(randomNumber * letters.length));

	    } else {

		referralCode = referralCode + Math.floor(randomNumber * 10);

	    }

	}

	var data = {

	    referrer_id: req.body.referrer_id,
	    referred_email: req.body.referred_email,
	    menu_ids: req.body.menu_ids,
	    referral_status: 0,
	    referral_code: referralCode

	}

	pool.getConnection(function(err, con) {

	    if(!err) {

		var checkLastReferral = function() {

		    return new Promise(function(resolve, reject) {

			var lastReferralQuery = "SELECT last_referral FROM `customer` where customer_id = '"+ data.referrer_id  +"'";

			con.query(lastReferralQuery, function(err, result) {

			    if(!err) {

				if(result[0].last_referral > 0) {

				    resolve(lastReferral = true);
				    resolve(timeLeft = result[0].last_referral);

				} else {

				    resolve();

				}

			    } else {

				throw err;

			    }

			})

		    })

		}

		var initialCheckReferCount = function() {

		    return new Promise(function(resolve, reject) {

			var queryGetReferralCount = "SELECT referrer_count FROM `customer` where customer_id = '"+ data.referrer_id  +"'";

			con.query(queryGetReferralCount, function(err, result) {

			    if(!err) {

				if(result[0].referrer_count >= 3) {

				    resolve(referralCountBoolean = true);

				} else {

				    resolve(referralCountBoolean = false);

				}

			    } else {

				throw err;

			    }

			})

		    })

		}

		var firstQueryFindEmail = function() {

		    return new Promise(function(resolve, reject) {

			var queryCustomerEmail = "SELECT customer_email FROM `customer` where customer_email = '"+ data.referred_email +"'";

			con.query(queryCustomerEmail, function(err, result) {

			    if(!err) {

				if(result.length == 0) {

				    resolve(foundEmail = false);

				} else {

				    resolve(foundEmail = true);

				}

			    } else {

				throw err;

			    }

			})

		    })

		}

		var secondQueryCheckRefer = function() {

		    return new Promise(function(resolve, reject) {

			var query = "SELECT referred_email from `referral` where referred_email = '"+ data.referred_email +"'";

			con.query(query, function(err, result) {

			    if(!err) {

				if(result.length == 0) {

				    resolve(foundEmailRefer = false);

				} else {

				    resolve(foundEmailRefer = true);

				}

			    } else {

				throw err;

			    }

			});

		    })

		}

		var thirdQueryInsert = function() {

		    return new Promise(function(resolve, reject) {

			if(foundEmailRefer == true) {

			    console.log("Already Referred!");
			    res.send("Email Exists Refer");

			} else if(foundEmail == false) {

			    var query = "INSERT INTO referral SET ?";

			    con.query(query, data, function(err, result) {

				if(!err) {

				    console.log("Referral Code: " + referralCode);
				    res.send(referralCode);
				    resolve();

				} else {

				    throw err;

				}

			    });

			} else {

			    console.log("Error: Email Exists");
			    res.send("Email Exists");
			    return;

			}

		    })

		}

		var setCustomerReferCountdown = function() {

		    return new Promise(function(resolve, reject) {

			var countdownQuery = "UPDATE `customer` SET last_referral = 86400 where customer_id = '"+ data.referrer_id +"'";

			con.query(countdownQuery, function(err, result) {

			    if(!err) {

				resolve();

			    } else {

				throw err;

			    }

			})

		    })

		}

	    initialCheckReferCount().then(function() {

		if(referralCountBoolean == true) {

		    console.log("Max Refers Reached");

		    res.send("Max Refers Reached");

		    con.release();

		} else {

		    checkLastReferral().then(function() {

//Then in the app, everytime the activity is closed, we send a string request to update the last referral with the new time left.

			if(lastReferral == true) {

			    res.send("Still time left"+ timeLeft  +"");

			    con.release();

			} else {

			    firstQueryFindEmail().then(function() {

				secondQueryCheckRefer().then(function() {

				    thirdQueryInsert().then(function(){

					setCustomerReferCountdown().then(function() {

					    con.release();

					})

				    });

				})

			    });

			}

		    })

		}

	    })

	    } else {

		throw err;

	    }

	});

});

app.post("/app/checkreferral", function(req, res) {

    var referralCode = req.body.referral_code;
    var customerEmail = req.body.customer_email;
    var dataTemp = {};
    var menuIdsString = "";

    pool.getConnection(function(err, con) {

	if(!err) {

	    var firstQuery = function() {

		return new Promise(function(resolve, reject) {

		    var query = "SELECT `referral`.referral_id, `referral`.referrer_id, `referral`.referred_email, `referral`.menu_ids, `referral`.referral_status, `referral`.referral_code, `customer`.first_name, `customer`.last_name, `customer`.customer_email FROM `referral` INNER JOIN `customer` ON `referral`.referral_code = '"+ referralCode +"' and `referral`.referred_email = '"+ customerEmail +"' and `customer`.customer_id = `referral`.referrer_id";

		    con.query(query, function(err, result) {

			if(!err) {

			    if(result.length == 0) {

				res.send("Non Existent");

			    } else {

				if(result[0].referral_status == -1) {

				    res.send("Cancelled");

				} else if(result[0].referral_status == 1) {

				    res.send("Completed");

				} else {

				    resolve(data = result[0]);

				    var menuIdsStringTemp  = data.menu_ids;
				    menuIdsStringTemp = menuIdsStringTemp.replace("[", "").replace("]", "");
				    menuIdsStringTemp = menuIdsStringTemp.replace(/\s/g, "");

				    resolve(menuIdsString = menuIdsStringTemp);

				}

			    }

			} else {

			    throw err;

			}

		    });

		});

	    }

	    var secondQuery = function() {

		return new Promise(function(resolve, reject) {

		    var query = "SELECT `menu`.menu_name, `menu`.menu_id FROM `menu` where menu_id IN (" + menuIdsString + ")";

		    con.query(query, function(err, result) {

			if(!err) {

			    resolve(data.menu_id_names = []);
			    resolve(data.menu_id_names.push.apply(data.menu_id_names, result));

			} else {

			    throw err;

			}

		    });

		})

	    }

	    firstQuery().then(function() {

		secondQuery().then(function() {

		    res.send(JSON.stringify(data));
		    con.release();

		})

	    });

	} else {

	    throw err;

	}

    });

});

app.post("/app/updatereferral", function(req, res) {

    var boolean = req.body.accepted;
    var referred_email = req.body.referred_email;
    var referrer_id = req.body.referrer_id;
    var unique_id = "";

    pool.getConnection(function(err, con) {

	if(!err) {

	    var updateStatus = function() {

		    return new Promise(function(resolve, reject) {

			var query = "";

			if(boolean == true) {

			    query = "UPDATE `referral` SET referral_status = '1' WHERE referred_email = '"+ referred_email  +"'";

			} else {

			    query = "UPDATE `referral` SET referral_status = '-1' WHERE referred_email = '"+ referred_email  +"'";

			}

			con.query(query, function(err, result) {

			    if(err) {

				throw err;

			    } else {

				resolve();

			    }

			});

		    })

		}

	    var updateReferralCount = function() {

		return new Promise(function(resolve, reject){

		    var query = "";

		    if(boolean == true) {

			query = "UPDATE `customer` SET referrer_count = referrer_count + 1 WHERE customer_id = '"+ referrer_id  +"'";

		    } else {

			resolve();
			return;

		    }

		    con.query(query, function(err, result) {

			if(!err) {

			    resolve();

			} else {

			    throw err;

			}

		    });

		})

	    }

	    var placeOrder = function() {

	    //Need to change box_id to -1, then in the order api we want to check if box_id is -1, if it is then we take from
	    //a new json data inside that will have the data for the menus that we want to order

		return new Promise(function(resolve, reject) {

		    request({
		    url: 'http://188.166.221.241:3000/app/order',
		    method: 'POST',

		    json: {

		    order_source: "app",
		    customer_id: ""+ req.body.customer_id +"",
		    box_id: "-1",
		    order_date: ""+ req.body.date  +"",
	    	    payment_method: "bank_transfer",
		    balance_discount: "0",
		    voucher_discount: "0",
		    delivery_fee: "0",
		    grandtotal: "0",

		    address: {
		    customer_name: ""+ req.body.customer_name +"",
		    mobile: ""+ req.body.mobile +"",
		    address_content: ""+ req.body.address_content +"",
		    city: ""+ req.body.city +"",
		    zipcode: ""+ req.body.zipcode +"",
		    address_notes: ""+ req.body.address_notes +"",
		    delivery_time: "12"

		    },

		    menu: req.body.menus,

		    voucher_id: "0"

		    }

		    }, function(err, response, body) {

			if(!err) {

			    //body parameter is the response that we get from the order api, so we just set unique_id to the body.

			    var data = {};

			    data.unique_id = body.toString();
			    data.order_date = req.body.date;
			    data.address_content = req.body.address_content;
			    data.customer_name = req.body.customer_name;

			    res.send(JSON.stringify(data));

			}

		    })

		}) 

	    }

	    updateStatus().then(function() {

		updateReferralCount().then(function() {

		    if(boolean == true) {

			placeOrder();

		    } else {

			res.send("Successfully Declined");

		    }

		});

	    })

	} else {

	    throw err;

	}

    })

});

app.listen(port);