module.exports = function(app,pool,moment,intercom_client) {

app.get("/referral/customer/:email",function(req,res){
    var customer_email = req.params.email;
    pool.getConnection(function(err,connection){
	connection.query("select customer_email,first_name,last_name,customer_id from customer  where customer_email = '"+customer_email+"'", function(err,rows){
	    res.json(JSON.stringify(rows));
	    connection.release();
	});
    });
});


app.get("/referral/menu/:date",function(req,res){
    var date = req.params.date;
    var q = "select m.menu_id,menu_name,menu_type,b.box_id from box b,menu m,box_menu bm where b.box_id = bm.box_id and bm.menu_id = m.menu_id and box_type = 3 and box_start <= '"+date+"' and box_end  >= '"+date+"' order by menu_type";
    pool.getConnection(function(err,connection){
        connection.query(q,function(err,rows) {
            connection.release();
            if(!err) { res.json(JSON.stringify(rows)); }
        });
    });
});


app.post("/referral/order/",function(req,res){
    var order_date = req.body.date;
    var menu = req.body.menus;
    var unique_id = Math.floor(Math.random() * 900000) + 100000;


    pool.getConnection(function(err,connection){
	var box_id = req.body.box_id;
	var grandtotal = 200000;	

	var q = "insert into `order`(unique_id,order_source,customer_id,box_id,order_date,payment_method,balance_discount,voucher_discount,grandtotal,payment_status,order_status) VALUES";
	q = q + "(" + unique_id + ",'BO',"+req.body.customer_id+","+box_id+",'"+order_date+"','referral',0,0,"+grandtotal+",0,0)";
	    
	connection.query(q, function(err,result){
	    var order_id = result.insertId;

	    var datas = {"order_id" : order_id,"customer_name" : req.body.first_name + " " + req.body.last_name, "address_content" : req.body.address_content };
	    datas.city = req.body.city;
	    datas.mobile = req.body.mobile;
	    datas.zipcode = req.body.zipcode;
	    datas.address_notes = req.body.address_notes;
	    connection.query("insert into order_address SET ?",datas,function(err,result1) {;});

	    for(var i = 0; i< menu.length; i++) {
		
		var menus = { "order_id" : order_id , "menu_id" : menu[i].menu_id, "portion" : "2" };
		connection.query("insert into order_menu SET ?",menus, function(err2,result2) {; });
	    }
	    connection.release();
	});
    });


    intercom_client.events.create({
	event_name: 'referral_box',
	created : moment().unix(),
	email : req.body.customer_email,
	metadata: { payment_method : 'referral', type : 'referral', order_id : unique_id },
    }, function(d) {

    });

    res.send("OK");
});

}