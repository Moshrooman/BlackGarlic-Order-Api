module.exports = function (app, pool, moment, sendgrid, Slack) {

    app.post("/orderextension", function (req, res) {

        var unique_id = req.body.unique_id;

        var apiToken = "xoxp-3512371997-6086264097-28815276167-7fc53b0ddd";

        var slack = new Slack(apiToken);

        // var client = new Intercom.Client("def0fyyg", "cc077cae04c7b47f9fa700daab7bca1c04207f3c");

        var slackData = {

            unique_id: unique_id,

            dataArray: []

        };

        Number.prototype.formatMoney = function (decPlaces, thouSeparator, decSeparator) {
            var n = this,
                decPlaces = isNaN(decPlaces = Math.abs(decPlaces)) ? 2 : decPlaces,
                decSeparator = decSeparator == undefined ? "." : decSeparator,
                thouSeparator = thouSeparator == undefined ? "," : thouSeparator,
                sign = n < 0 ? "-" : "",
                i = parseInt(n = Math.abs(+n || 0).toFixed(decPlaces)) + "",
                j = (j = i.length) > 3 ? j % 3 : 0;
            return sign + (j ? i.substr(0, j) + thouSeparator : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + thouSeparator) + (decPlaces ? decSeparator + Math.abs(n - i).toFixed(decPlaces).slice(2) : "");
        };


        pool.getConnection(function (err, con) {


            var test = "SELECT `order`.order_id, `order`.order_date, `order`.voucher_discount, `order`.order_source, `order`.payment_method, `order`.customer_id, `order`.customer_id, `order`.delivery_fee, `order`.grandtotal, order_menu.menu_id, order_menu.portion, `menu`.menu_type, `menu`.menu_name, `customer`.customer_email, order_address.delivery_time, order_address.customer_name, order_address.address_content, order_address.city, order_address.city, order_address.mobile, order_address.address_notes FROM `order` INNER JOIN order_menu ON `order`.unique_id = " + unique_id + " and order_menu.order_id = `order`.order_id INNER JOIN `menu` ON `menu`.menu_id = order_menu.menu_id INNER JOIN `customer` ON `customer`.customer_id = `order`.customer_id INNER JOIN order_address ON order_address.order_id = `order`.order_id";

            con.query(test, function (err, result) {
                if (err) {

                    throw err;

                } else {

                    slackData.dataArray.push.apply(slackData.dataArray, result);

                    var htmlCode = "";

                    var originalTwoPerson = 0;
                    var originalFourPerson = 0;

                    var breakfastTwoPerson = 0;
                    var breakfastFourPerson = 0;

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
                        } else {
                            breakfastFourPerson++;
                            subTotal = subTotal + 140000;
                            htmlCode = htmlCode + "<tr><td>1</td><td>" + slackData.dataArray[i].menu_name + " (4P)</td><td>140,000</td></tr>";
                        }
                    }
            
                    //Start of code to send message to slack

                    slack.api('chat.postMessage', {
                        text: "New " + slackData.dataArray[0].order_source.toUpperCase() + " Order: " + slackData.dataArray[0].customer_email + " -> " + slackData.dataArray.length + " items = \n\n " + "Breakfast:\n" + "Two Person: " + breakfastTwoPerson + "\n" + "Four Person: " + breakfastFourPerson + "\n\n" + "Original:\n" + "Two Person: " + originalTwoPerson + "\n" + "Four Person: " + originalFourPerson + " \n\n Delivery Fee " + slackData.dataArray[0].delivery_fee.formatMoney(0, ',', '') + " --> " + slackData.dataArray[0].grandtotal.formatMoney(0, ',', '') + "",
                        channel: "#cs",
                        username: "OrderBot"
                    }, function (err, response) {
                        if (err) {
                            throw err;
                        }

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

                    email.addSubstitution('orderrow', htmlCode);



                    sendgrid.send(email, function (err, json) {

                        if (err) {
                            throw err;
                        }

                    });
                    
                    //End of code to send email using sendgrid


                    res.send("OK");

                }

            });


        });


    });


}