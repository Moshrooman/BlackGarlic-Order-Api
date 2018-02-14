module.exports = function(app,pool,moment) {


app.get("/slack/order/",function(req,res){
    var time = req.query.text;
    if(time == 'next') {
	var from = moment().startOf('week').add(7,'days').format('YYYY-MM-DD');
	var to = moment().startOf('week').add(13,'days').format('YYYY-MM-DD');

	pool.getConnection(function(err,connection){
	    connection.query("select count(*) as cnt,order_date from `order` where order_status = 0 and payment_status = 1 and order_date between '"+from+"' and '"+to+"' group by order_date order by order_date",function(err,rows) {
		connection.release();
		if(!err) {
		    var retval = "";
		    for(var i = 0;i<rows.length;i++) {
			retval = retval + rows[i].order_date + " -> " + rows[i].cnt + "\n";
		    }
		    res.send(retval);
		}
	    });
	});
    } else {
	var from = moment().startOf('week').format('YYYY-MM-DD');
	var to = moment().startOf('week').add(6,'days').format('YYYY-MM-DD');
	if(moment().day() == 0) {
	    var from = moment().add(1,'days').format('YYYY-MM-DD');
	    var to = moment().add(7,'days').format('YYYY-MM-DD');
	}
	pool.getConnection(function(err,connection){
	    connection.query("select count(*) as cnt,order_date from `order`  where payment_status = 1 and order_status IN (0,1) and order_date between '"+from+"' and '"+to+"' group by order_date order by order_date",function(err,rows) {
		connection.release();
		if(!err) {
		    var retval = "";
		    for(var i = 0;i<rows.length;i++) {
			retval = retval + rows[i].order_date + " -> " + rows[i].cnt + "\n";
		    }
		    res.send(retval);
		}
	    });
	});
    }
});


app.get("/slack/menu/",function(req,res){
    var time = req.query.text;
    if(time == 'next') {
	var from = moment().startOf('week').add(7,'days').format('YYYY-MM-DD');
	var to = moment().startOf('week').add(13,'days').format('YYYY-MM-DD');
    } else {
	var from = moment().startOf('week').format('YYYY-MM-DD');
	var to = moment().startOf('week').add(6,'days').format('YYYY-MM-DD');
	if(moment().day() == 0) {
	    var from = moment().add(1,'days').format('YYYY-MM-DD');
	    var to = moment().add(7,'days').format('YYYY-MM-DD');
	}
    }

    pool.getConnection(function(err,connection){
        connection.query("SELECT m.menu_id,menu_name,portion,menu_type,order_date,count(*) as cnt FROM `order` o,order_menu om,menu m WHERE o.order_id = om.order_id and order_date between '"+from+"' and '"+to+"' and payment_status = 1 and order_status >= 0 and om.menu_id = m.menu_id GROUP BY menu_id,portion,order_date ORDER BY menu_type,menu_id,portion,order_date",function(err,rows) {
    	    connection.release();
	    if(!err) {
		    var retval = "";
		    var marker = 0;
		    var mn = "";
		    for(var i = 0;i<rows.length;i++) {
			if(marker != rows[i].menu_type) {
			    marker = rows[i].menu_type;
			    if(marker == 3)
				retval = retval + "Original Menu";
			    else
				retval = retval + "\nBreakfast Menu";
			}
			var dt = new Date(rows[i].order_date);
			if(mn != (rows[i].menu_id)+(rows[i].portion)) {
			    mn = (rows[i].menu_id)+(rows[i].portion);
			    retval = retval + "\n";
			    retval = retval + String(rows[i].menu_name).substring(0,15) + " " + rows[i].portion+ "P -> ";
			}
			retval = retval + " " + dt.getDate()+ "(" + rows[i].cnt + ")";
		    }
		    res.send(retval);
	    }
        });
    });
    
});

}
