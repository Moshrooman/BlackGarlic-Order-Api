var mandrill_msg = require('../mandrill-orderstatus.js');
module.exports = function(app,pool,moment,mandrill_client) {

app.get("/bo/order/week/:start",function(req,res){
    var from = req.params.start;
    var to = moment(from).add(6,'days').format('YYYY-MM-DD');
    var retval = [];
    pool.getConnection(function(err,connection){
	var q = "";
	if(moment(from).isBefore('2015-09-27')) {
	    q = "select o.order_id,unique_id,customer_email,order_date,grandtotal,payment_method,payment_status,order_status,box_type,a.* ";
	    q = q + " from customer c,`order` o,order_address a,box b ";
	    q = q + " where o.box_id = b.box_id and o.customer_id = c.customer_id and o.order_id = a.order_id and order_date between '"+from+"' and '"+to+"'";
	    connection.query(q,function(err,rows) {
		if(!err) {
		    res.json(JSON.stringify(rows));
		}
	    });
	} else {
	    q = "select o.order_id,unique_id,customer_email,order_date,delivery_fee,grandtotal,payment_method,payment_status,order_status,box_type,a.*,menu_name,m.menu_type,portion ";
	    q = q + " from customer c,`order` o,order_address a,box b,order_menu mn,menu m ";
	    q = q + " where o.order_id = mn.order_id and mn.menu_id = m.menu_id and o.box_id = b.box_id and o.customer_id = c.customer_id and o.order_id = a.order_id and order_date between '"+from+"' and '"+to+"'";
	    connection.query(q,function(err,rows) {
		if(!err) {
    		    var datas = rows;
		    var datas1 = [];
		    var retval = [];
		    for(var i = 1;i< datas.length;) {
			//delete datas[i].menu_id;
			if(datas[i-1].order_id == datas[i].order_id) {
			    if(datas[i].portion == 2)
				datas1.push("(2P) "+datas[i].menu_name);
			    else
				datas1.push("(4P) "+datas[i].menu_name);
			    datas.splice(i,1);
			    
			} else { 
			    if(datas[i-1].portion == 2)
				datas1.push("(2P) "+datas[i-1].menu_name);
			    else
				datas1.push("(4P) " + datas[i-1].menu_name);
			    datas[i-1].menu_ids = datas1;
			    datas1 = [];
			    i++; 
			}
			if(i == datas.length) {
			    if(datas[i-1].portion == 2)
				datas1.push("(2P) "+datas[i-1].menu_name);
			    else
				datas1.push("(4P) " + datas[i-1].menu_name);
			    datas[i-1].menu_ids = datas1;
			    datas1 = [];
			}
		    }
		    res.json(JSON.stringify(datas));
		}
	    });
	}
	connection.release();
    });
});
app.get("/bo/order/menu/:order_id",function(req,res){
    var from = req.params.order_id;
    pool.getConnection(function(err,connection){
	var q = "select n.menu_id,menu_name from menu m,order_menu n where m.menu_id = n.menu_id and order_id =" + from;
	connection.query(q,function(err,rows) {
	    if(!err) {
		res.json(JSON.stringify(rows));
	    }
	});
	connection.release();
    });
});

app.get("/bo/orderdl/:time",function(req,res){
    var from = req.params.time;
    var to = moment(from).add(6,'days').format('YYYY-MM-DD');

    res.setHeader('Content-disposition','attachment; filename= order.txt');
    res.setHeader('Content-type','text/plain');

    pool.getConnection(function(err,connection){
        connection.query("select o.order_id,unique_id,order_date,grandtotal,payment_status,order_status,a.*,customer_email from `order` o,order_address a,box b,customer c where o.customer_id = c.customer_id and o.box_id = b.box_id and payment_status=1 and o.order_id = a.order_id and order_date between '"+from+"' and '"+to+"' order by order_date",function(err,rows){
            connection.release();
            if(!err) {
		var retval = "order_id;order_date;customer_email;customer_name;mobile;address_content;city;zipcode;notes\r\n";
                for(var i = 0;i < rows.length;i++){
		    retval = retval + rows[i].unique_id + ";";
		    retval = retval + rows[i].order_date + ";" + rows[i].customer_email + ";" + rows[i].customer_name + ";" + rows[i].mobile + ";\"" + String(rows[i].address_content).replace(new RegExp('\r?\n','g'),' ') + "\";";
		    if(rows[i].city == 1)
			retval = retval + "Jakarta Pusat;";
		    else if(rows[i].city == 2)
			retval = retval + "Jakarta Selatan;";
		    else if(rows[i].city == 3)
			retval = retval + "Jakarta Barat;";
		    else if(rows[i].city == 4)
			retval = retval + "Jakarta Utara;";
		    else if(rows[i].city == 5)
			retval = retval + "Jakarta Timur;";
		    else if(rows[i].city == 6)
			retval = retval + "Tangerang;";
		    else if(rows[i].city == 7)
			retval = retval + "Bekasi;";
		    else if(rows[i].city == 8)
			retval = retval + "Tangerang Selatan;";
		    else
			retval = retval + "Depok";
		    retval = retval + rows[i].zipcode + ";\"" + String(rows[i].address_notes).replace(new RegExp('\r?\n','g'),' ') + "\"";
		    retval = retval + "\r\n";
		}
		res.send(retval);
            }
        });
    });
});

app.post("/bo/order/paid/",function(req,res) {
    var order_id = req.body.order_id;
    var template_name = "order-status";
    pool.getConnection(function(err,connection){
	connection.query("select c.customer_email,c.customer_id,c.customer_status,a.customer_name,unique_id from `order` o,customer c,order_address a  where o.order_id = a.order_id and o.customer_id = c.customer_id and o.order_id = "+ order_id, function(err,rows) {
	    var to = rows[0].customer_email;
	    var cust_id = rows[0].customer_id;
	    var cust_status = rows[0].customer_status;
	    var content = [{ 
		    "name" : "fname",
		    "content" : rows[0].customer_name
		}, {
		    "name" : "order_id",
		    "content" : rows[0].unique_id
		}, {
		    "name" : "order_status",
		    "content" : "PAID"
		}];
	    var msg = mandrill_msg.getJSONMessage(to,rows[0].unique_id);  
	    
    	    connection.query("update `order` set payment_status = 1 where order_id = " + order_id, function(err,rows) {
		if(cust_status == 0) {
		    connection.query("update `customer` set customer_status = 1 where customer_id = " + cust_id, function(err,rows) {
			connection.release();
		    });
		} else {
		    connection.release();
		}
	    });

	    mandrill_client.messages.sendTemplate({"template_name" : template_name, "template_content" : content, "message" : msg, "async":false },function(result) {
		//console.log(result);
	    }, function(e) { 
		//=console.log(e.name + ' - ' + e.message);
	    });
	});
	res.json({"update":"ok"});
    });
});

app.post("/bo/order/complete/",function(req,res) {
    var order_id = req.body.order_id;
    pool.getConnection(function(err,connection){
        connection.query("update `order` set order_status = 2 where order_id = " + order_id, function(err,rows) {
	    connection.query("select * from order_address where order_id = " + order_id , function(err,rows) {
		var mobile = rows[0].mobile;
        	connection.release();
        	res.json({ "update" : "ok" });
	    });
        });
    });
});

app.post("/bo/order/cancel/",function(req,res) {                       
    var order_id = req.body.order_id;                                    
    pool.getConnection(function(err,connection){                         
        connection.query("update `order` set order_status = -1 where order_id = " + order_id, function(err,rows) {
            connection.release();
            res.json({ "update" : "ok" });
        });
    });
});

}