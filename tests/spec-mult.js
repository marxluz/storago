describe('DB test', function(){

  it('is exists', function(){
      expect(window.openDatabase).toBeDefined();
      expect(storago).toBeDefined();
  });

  it('create table', function(){

    var Boat = storago.define('boats', {type: 'text', size: 'text'});

    var Brand = storago.define('brands', {name: 'text'});

    var Car = storago.define('cars', {type: 'text', color: 'text'});
    Car.hasMany('brand', Brand, 'cars');



    storago.connect('shop_car', '1.0', 'Showrow of cars', 5 * 1024 * 1024);
    storago.syncSchema();

    /*
    var katamaran = new Boat();
    katamaran.id = 12;

    //console.log(car._META.parents);
    var fiat = new Brand();
    fiat.name = 'Fiat';
    fiat.save();

    var vw = new Brand();
    vw.name = 'Volkswagen';
    vw.save();

    var palio = new Car();
    palio.type = 'SW';
    palio.color = 'Black';
    palio.brand(fiat);
    palio.save();
    */
    //console.log(palio);



    //console.log(boat._META);

  });
});
