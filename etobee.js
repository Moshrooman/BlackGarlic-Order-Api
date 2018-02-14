module.exports = function(app,pool,moment,request) {

app.get("/bo/etobee/day/:day",function(req,res){
    var day = req.params.day;
    var retval = [];
    pool.getConnection(function(err,connection){
	var q = "select o.order_id,unique_id,customer_email,order_date,grandtotal,payment_method,payment_status,order_status,a.* ";
	    q = q + " from customer c,`order` o,order_address a ";
	    q = q + " where payment_status = 1 and order_status IN (0,1) and  o.customer_id = c.customer_id and o.order_id = a.order_id and order_date  ='"+day+"' ";
	connection.query(q,function(err,rows) {
		res.json(JSON.stringify(rows));
	});
	
	connection.release();
    });
});

app.post("/bo/etobee/send/",function(req,res){
    var order_id = req.body.order_id
    var date = moment(req.body.date+"T11:00");

    var cities = ["X","Jakarta Pusat", "Jakarta Selatan", "Jakarta Barat", "Jakarta Utara" , "Jakarta Timur", "Tangerang", "Bekasi", "Tangerang Selatan", "Depok" ];
    var states = ["x","Jakarta","Jakarta","Jakarta","Jakarta","Jakarta","Banten","Jawa Barat","Banten","Jawa Barat" ];
    pool.getConnection(function(err,connection){
	connection.query("select a.*,unique_id,customer_email from `order` o,order_address a,customer c where o.customer_id = c.customer_id and o.order_id = a.order_id and o.order_id = "+order_id,function(err,rows) {
	    var body_data = {
		select_driver: false,
		web_order_id: 1233413,
		sender:
   { name: 'BlackGarlic',
     mobile: '+6281282714345',
     email: 'cs@blackgarlic.id' },
  origin:
   { address: 'Jln Brawijaya 8 no 6A, Kebayoran Baru',
     city: 'Jakarta Selatan',
     state: 'Jakarta',
     country: 'Indonesia',
     postcode: '12160' },
  origin_comments: 'seberang Kantor Walikota Jakarta Selatan',
  recipient:
   { name: rows[0].customer_name,
     mobile: rows[0].mobile,
     email: rows[0].customer_email },
  destination:
   { address: 'Jln Kramat Jaya Baru Elok E7/31',
     city: cities[rows[0].city],
     state: states[rows[0].city],
     country: 'Indonesia',
     postcode: rows[0].zipcode },
  package:
   { quantity: 1,
     transaction_value: 40000,
     size: 'Motorcycle',
     weight: 6,
     volume: 1,
     note: 'TEST' },
  pickup_time: date.unix(),
  destination_comments: "TESTING"
	    };
	    console.log(body_data);

	    request({
		'auth' : { 'user' : 'bani@blackgarlic.id', 'pass' : ‘PASSWORD’ },
		method : 'POST',
		uri : 'http://api.staging.etobee.com:3001/api/create_order',
		json : true,
		body : body_data,
		}, function(error,response,body){
		    console.log(body);
	    });


	
	});
	connection.release();
    });
});


app.post("/bo/etobee/send-bulk/",function(req,res){
    var orders = req.body.orders;
    var date = moment(req.body.date);

    var cities = ["X","Jakarta Pusat", "Jakarta Selatan", "Jakarta Barat", "Jakarta Utara" , "Jakarta Timur", "Tangerang", "Bekasi", "Tangerang Selatan", "Depok" ];

    pool.getConnection(function(err,connection){
	for(var i = 0; i< orders.length; i++) {
    	    connection.query("select a.*,unique_id,customer_email from `order` o,order_address a,customer c where o.customer_id = c.customer_id and o.order_id = a.order_id and o.order_id = "+orders[i],function(err,rows) {
		
		var body_data = {
			"select_driver" : false,"web_order_id" : rows[0].unique_id,

			"sender" : {"name":"BlackGarlic","mobile":"+6281282714345","email":"cs@blackgarlic.id" },
			"origin" : { "address" : "Jln Brawijaya 8 no 6A, Kebayoran Baru","city" : "Jakarta Selatan","state" : "Jakarta","country":"Indonesia","postcode":"12160"},
			"origin_comments" : "seberang Kantor Walikota Jakarta Selatan",
			"recipient" : { "name" : rows[0].customer_name ,"mobile" : rows[0].mobile,"email" : rows[0].customer_email },
			"destination" : { "address" : "Jln Kramat Jaya Baru Elok E2/76" ,"city" : cities[rows[0].city],"state" : " Jakarta", "country":"Indonesia", "postcode" : rows[0].zipcode},
			"destination_comments" : rows[0].address_notes,

			"package" : { "quantity" : 1,"transaction_value":40000, "size":"Motorcycle","weight":1,"volume":0.1,"note":"Fragile" },
			"pickup_time" : date.unix(),
		    };
		console.log(body_data);
	    });
	}
	connection.release();
    });


/*
    request({
	'auth' : { 'user' : 'bani@blackgarlic.id', 'pass' : ‘PASSWORD’ },
	method : 'POST',
	uri : 'http://api.etobee.com:3001/api/create_order',
	json : true,
	body : body_data
	}, function(error,response,body){
	console.log(body);
    });
*/
});

}