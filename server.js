var express = require("express");
var request = require("request");
var port = "7000";
var mysql = require("mysql");
var app = express();
var jwt = require("express-jwt");
var bodyParser = require("body-parser");
var moment = require("moment");
var pool = mysql.createPool({
	    connectionLimit : 100,
	    host : 'IP',
	    user : 'USER',
	    password : 'PASSWORD',
	    database : 'DATABASE',
	    dateStrings: true,
	    debug : false
});
var mandrill = require('mandrill-api/mandrill');
var mandrill_client = new mandrill.Mandrill('LI4BPFO5tN1bvCT6to4CAw');
var nexmo = require("easynexmo");
var phone = require("node-phonenumber");
var mandrill_msg = require('./mandrill-orderstatus.js');
var Intercom = require('intercom-client');
var intercom_client = new Intercom.Client('def0fyyg','cc077cae04c7b47f9fa700daab7bca1c04207f3c');

nexmo.initialize("c2af9db4","9b4d9ce3","https",false);
var phoneUtil = phone.PhoneNumberUtil.getInstance();


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(function(req,res,next){
    res.header("Access-Control-Allow-Origin","*");
    res.header("Access-Control-Allow-Headers","Origin, X-Requested-With,Content-Type,Accept");
    next();
});


app.use(function(req,res,next){
    console.log('%s %s',req.method,req.url);
    next();
});

// ROUTES
require('./routes/customer.js')(app,pool);
require('./routes/slack.js')(app,pool,moment);
require('./routes/order.js')(app,pool,moment,mandrill_client);
require('./routes/etobee.js')(app,pool,moment,request);
require('./routes/referral.js')(app,pool,moment,intercom_client);


app.post("/auth/login/",function(req,res) {
    console.log(req.body);
    res.json({ "login" : "1" });
});

app.get("/auth/login/",function(req,res){
    console.log(req.body);
    res.json({ "login" : "1" });
});

app.post("/bo/login/",function(req,res) {
    var user = req.body.username;
    var pswd = req.body.password;
    pool.getConnection(function(err,connection){
	connection.query("select operator_name,login,operator_type from operator where login = '" + user + "' and password = '"+pswd+"';",function(err,rows) {
	    connection.release();
	    if(!err) {
		if(rows.length == 0)
		    res.json({ "login" : "0"});
		else {
		    res.json({ "login" : "1" , "info" : JSON.stringify(rows[0])});
		}
	    }
	});
    });    
});


/* BOX ROUTER */
app.get("/bo/box/",function(req,res){
    pool.getConnection(function(err,connection){
	connection.query("select b.*,menu_name from box b,menu m,box_menu bm where b.box_id = bm.box_id and bm.menu_id = m.menu_id",function(err,rows) {
	    connection.release();
	    if(!err) { res.json(JSON.stringify(rows)); }
	});
    });
});


/* MENU ROUTER */
app.get("/bo/menu/",function(req,res){
    pool.getConnection(function(err,connection){
        connection.query("select * from menu",function(err,rows) {
            connection.release();
            if(!err) { res.json(JSON.stringify(rows)); }
        });
    });
});

app.get("/bo/menu/ordering/:date",function(req,res){
    var package = req.params.package;
    var date = req.params.date;
    var q = "select m.menu_id,menu_name,menu_type,b.box_id from box b,menu m,box_menu bm where b.box_id = bm.box_id and bm.menu_id = m.menu_id and box_start <= '"+date+"' and box_end  >= '"+date+"' order by menu_type";
    pool.getConnection(function(err,connection){
        connection.query(q,function(err,rows) {
            connection.release();
            if(!err) { res.json(JSON.stringify(rows)); }
        });
    });

});

app.get("/bo/menu/:menu_id",function(req,res){
    var menu_id = req.params.menu_id;
    pool.getConnection(function(err,connection){
        connection.query("select * from menu where menu_id ="+menu_id,function(err,rows) {
	    var retval = {};
            if(!err) {  
		retval = rows; 
		connection.query("Select * from ingredient i ,menu_ingredient mi where mi.ingredient_id = i.ingredient_id and menu_id = "+menu_id,function(err,rows){
		    connection.release();
		    retval.push({ "ingredients" : rows });
		    res.json(JSON.stringify(retval));
		});
	    }
        });
    });
});

app.post("/bo/menu/",function(req,res) {
    var menu_name = req.body.menu_name;
    var menu_subname = req.body.menu_subname;
    var menu_url = req.body.menu_url;
    var ingredient = req.body.ingredient;

    pool.getConnection(function(err,connection){
	connection.query("insert into menu(menu_name,menu_subname,menu_url) VALUES('"+menu_name+"','"+menu_subname+"','"+menu_url+"')", function(err,rows) {
	    res.json({ "update" : "ok" });
	    connection.release();
	})
    });
});


/* INGREDIENT */
app.post("/bo/menu/ingredient/",function(req,res) {
    var menu_id = req.body.menu_id;
    var ingredients = req.body.ingredients;

    pool.getConnection(function(err,connection){
	connection.query("delete from menu_ingredient where menu_id = " + menu_id, function(err,rows) {
	    for(var i = 0 ; i < ingredients.length; i++) {
		//console.log(menu_id+ " " +ingredients[i].ingredient_id);
		connection.query("insert into menu_ingredient(menu_id,ingredient_id) VALUES("+menu_id+","+ingredients[i].ingredient_id+")",function(err,rows) {
		});
	    }
	    res.json({ "update" : "ok" });
	    connection.release();
	})
    });
});

app.get("/bo/ingredient/",function(req,res){
    pool.getConnection(function(err,connection){
        connection.query("select * from ingredient",function(err,rows) {
	    connection.release();
            if(!err) {  
		res.json(JSON.stringify(rows));
	    }
        });
    });
});

app.post("/bo/ingredient/",function(req,res) {
    var ingredients = req.body.ingredient_name;

    pool.getConnection(function(err,connection){
        connection.query("insert into ingredient(ingredient_name) VALUES('" + ingredients + "')", function(err,result) {
            res.json({ "id" : result.insertId });
            connection.release();
        })
    });
});

/* RECIPE CARD */

app.get("/bo/menu/recipe/:menu_id",function(req,res) {
    var menu_id = req.params.menu_id;
    pool.getConnection(function(err,connection){
	connection.query("select * from recipe where menu_id = " + menu_id,function(err,rows) {
	    res.json(JSON.stringify(rows));
	});
    });
});

app.post("/bo/menu/recipe/",function(req,res){
    var menu_id = req.body.menu_id;
    var steps = req.body.steps;
    pool.getConnection(function(err,connection){
	connection.query("delete from recipe where menu_id = "+menu_id, function(err,rows){
	    for(var i = 0 ; i < steps.length; i++) {
		connection.query("insert into recipe(menu_id,steps_order,content_en,content_id) VALUES("+menu_id+","+steps[i].steps_order+",'"+steps[i].content_en+"','"+steps[i].content_id+"')", function(err,rows){
		});
	    }
	    connection.release();
	});
    });
    res.json({ "steps" : "1" });
});

app.get("/bo/menu/recipe/activate/:menu_id",function(req,res) {
    var menu_id = req.params.menu_id;
    pool.getConnection(function(err,connection){
	connection.query("update menu set menu_status = 1 where menu_id = " + menu_id,function(err,rows) {
	    connection.query("select * from menu",function(errz,rowz) {
		connection.release();
		res.json(JSON.stringify(rowz));
	    });
	});
    });
});

app.get("/bo/menu/recipe/deactivate/:menu_id",function(req,res) {
    var menu_id = req.params.menu_id;
    pool.getConnection(function(err,connection){
	connection.query("update menu set menu_status = 0 where menu_id = " + menu_id,function(err,rows) {
	    connection.query("select * from menu",function(errz,rowz) {
		connection.release();
		res.json(JSON.stringify(rowz));
	    });
	});
    });
});


app.post("/bo/order/",function(req,res){
    var box_type = req.body.box_type;
    var order_date = req.body.order_date;
    var menu = req.body.menu;
    var unique_id = Math.floor(Math.random() * 900000) + 100000;

    pool.getConnection(function(err,connection){
	var box_id = req.body.box_id;
	var grandtotal = req.body.grandtotal;		

	var q = "insert into `order`(unique_id,order_source,customer_id,box_id,order_date,payment_method,balance_discount,voucher_discount,grandtotal,payment_status,order_status) VALUES";
	q = q + "(" + unique_id + ",'BO',"+req.body.customer_id+","+box_id+",'"+order_date+"','bank_transfer',0,0,"+grandtotal+",0,0)";
	    
	connection.query(q, function(err,result){
	    var order_id = result.insertId;

	    var datas = {"order_id" : order_id,"customer_name" : req.body.address.customer_name, "address_content" : req.body.address.address_content };
	    datas.city = req.body.address.city;
	    datas.mobile = req.body.address.mobile;
	    datas.zipcode = req.body.address.zipcode;
	    datas.address_notes = req.body.address.address_notes;
	    connection.query("insert into order_address SET ?",datas,function(err,result1) {;});

	    for(var i = 0; i< menu.length; i++) {
		
		var menus = { "order_id" : order_id , "menu_id" : menu[i].menu_id, "portion" : menu[i].portion };
		connection.query("insert into order_menu SET ?",menus, function(err2,result2) {; });
	    }
	    connection.release();
	});
    });
    

/*
    intercom_client.events.create({
	event_name : 'purchase_box',
	created_at : moment().unix(),
	email : req.body.customer_email,
	metadata : { "type" : "retail", "order_id" : unique_id, "payment_method" : "bank_transfer" }
    },function(d) {
    });
*/
    res.send("OK");
});

app.listen(port);
