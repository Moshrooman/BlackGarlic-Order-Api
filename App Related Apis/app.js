module.exports = function(app, pool, moment, request, Slack) {

    app.post("/app/login", function(req, res) {

        var email = req.body.email;
        var password = req.body.password;

        var data = {};

        var customerQuery = "select customer_email, customer_password, customer_id, first_name, last_name FROM customer where customer_email = '" + email + "' and customer_password = '" + password + "';";

        pool.getConnection(function(err, connection) {

            connection.query(customerQuery, function(err, result) {

                if (err) {
                    throw err;
                    res.send("Invalid Username/Password");
                } else {

                    data.customer_name = result[0].first_name + " " + result[0].last_name;
                    data.customer_id = result[0].customer_id;

                    connection.query("select address_id, address_content, city, mobile, zipcode, address_notes FROM customer_address where customer_id = '" + data.customer_id + "';", function(err, result) {

                        if (result.length == 0) {
                            data.address_id = "-1";

                            res.send(JSON.stringify(data) + "<br><br>" + "No address found!");


                        } else {
                            data.address_id = result[0].address_id;
                            data.address_content = result[0].address_content;
                            data.city = result[0].city;
                            data.mobile = result[0].mobile;
                            data.zipcode = result[0].zipcode;
                            data.address_notes = result[0].address_notes;

                            res.send(JSON.stringify(data));

                        }

                    });

                }

            });

            connection.release();

        });

    });

    app.get("/app/menu/:date", function(req, res) {

        //Date in the format of YYYY-MM-DD
        var date = req.params.date;

        pool.getConnection(function(err, con) {

            con.query("select box_id from box where (box_start <= '" + date + "') and ('" + date + "' <= box_end);", function(err, result) {

                var data = {

                    box_ids: [],
                    menu_ids: [],
                    menus: [],

                };

                if (err) {
                    throw err;
                } else {

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

                            }

                        });

                    });

                }

                con.release();

            });

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
            referrer: "0"

        };

        pool.getConnection(function(err, connection) {

            var q = "INSERT INTO customer SET ?";

            connection.query(q, data, function(err, result) {

                if (!err) {
                    res.send("Successful");
                } else if (err.code === "ER_DUP_ENTRY") {
                    res.send("Duplicate");
                }

            });

            connection.release();

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

        pool.getConnection(function(err, connection) {

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

                connection.query(firstq, sendData, function(err, result) {

                    if (err) {
                        throw err;
                    } else {
                        res.send("Successfully Added");
                    }

                });

            } else {

                var secondq = "UPDATE customer_address SET ? WHERE customer_id = '" + data.customer_id + "';";

                connection.query(secondq, data, function(err, result) {

                    if (err) {
                        throw err;
                    } else {
                        res.send("Succesfully Updated");
                    }

                });

            }

        })

    });

    app.post("/app/order", function(req, res) {


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

            var secondQueryData;

            var firstQuery = function() {

                var counter = 0;

                return new Promise(function(resolve, reject) {

                    var q = "INSERT INTO `order` SET ?";

                    con.query(q, firstQueryData, function(err, result) {

                        if (err) {
                            res.send("ERROR");
                        } else {

                            console.log(result);

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

                        if (err) {
                            res.send("ERROR");
                        } else {
                            resolve("DONE");
                        }

                    });



                    res.sendStatus(firstQueryData.unique_id);

                })


            }

            var thirdQuery = function(menus, i, stoppoint) {
                //Third Query (into order_menu)

                return new Promise(function(resolve, reject) {

                    con.query("INSERT INTO order_menu SET ?", menus, function(err, result) {

                        if (err) {
                            res.send("ERROR");
                        } else {
                            
                            if (i == stoppoint) {

                                request({

                                    url: 'http://api.blackgarlic.id:7000/orderextension',
                                    method: 'POST',

                                    json: {
                                        unique_id: firstQueryData.unique_id
                                    }

                                }, function(err, response, body) {
                                    if (err) {
                                        res.send("ERROR");

                                    } else {
                                        con.release();
                                    }

                                })

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
            channel: "#payment_confirmation",
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

        pool.getConnection(function(err, con) {

            var q = "SELECT `order`.order_id, `order`.unique_id, `order`.grandtotal, `order`.payment_status, `order`.order_status, `order`.order_date, `order`.added, order_address.address_content, order_address.mobile FROM `order` INNER JOIN order_address on customer_id = " + customer_id + " and `order`.order_id = order_address.order_id ORDER BY added DESC LIMIT 5";

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

                    var getThirdQuery = (function(order_id, position) {

                        return new Promise(function(resolve, reject) {

                            var q3 = "SELECT order_menu.portion, order_menu.menu_id, `menu`.menu_name, `menu`.menu_type FROM order_menu INNER JOIN `menu` on order_menu.order_id = " + order_id + " and `menu`.menu_id = order_menu.menu_id";

                            con.query(q3, function(err, result) {

                                if (err) {
                                    throw err;
                                } else {
                                    resolve(
                                        orders[position].menus.push.apply(orders[position].menus, result)
                                    );

                                    if (position == orders.length - 1) {

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

        })


    });

}