module.exports = function(app,pool) {

app.post("/bo/customer/",function(req,res){
    var menu_id = req.body.customer_email;
    pool.getConnection(function(err,connection){
	connection.query("select * from customer  where customer_email = '"+menu_id+"'", function(err,rows){
	    if(rows.length > 0) {
		connection.query("select * from customer_address where customer_id = "+rows[0].customer_id, function(err1,rows1){
		    if(rows1.length > 0)
			res.json({ "customer" : JSON.stringify(rows[0]) , "address" : JSON.stringify(rows1[0])});
		    else
			res.json({ "customer" : JSON.stringify(rows[0]) , "address" : 0});
		});
	    } else {
		res.json({ "customer" : 0, "address" : 0 });
	    }
	    connection.release();
	});
    });
});

}