storago.debug = true;

var Brand = storago.define('brands', {name: 'text'});

var Car = storago.define('cars', {type: 'text', color: 'text'});
Car.hasMany('brand', Brand, 'cars');


storago.connect('shop_car', '1.0', 'Showrow of cars', 5 * 1024 * 1024);
storago.schema();


//console.log(car._META.parents);
var fiat = new Brand();
fiat.name = 'Fiat';
fiat.save(function(row){
   var palio = new Car();
   palio.type = 'SW';
   palio.color = 'Black';
   palio.brand(row);
   palio.save();
});

var vw = new Brand();
vw.name = 'Volkswagen';
vw.save();

Brand.find(1, function(row){

   console.log(row.name);
   row.name = 'Ford';
   row.save();
});
