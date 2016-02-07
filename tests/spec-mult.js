describe('DB test', function(){

  it('is exists', function(){
      expect(window.openDatabase).toBeDefined();
      expect(storago).toBeDefined();
  });

  it('create table', function(){

    var Brand = storago.define('brands', {name: 'text'});

    var Car = storago.define('cars', {type: 'text', color: 'text'});
    Car.hasMany('brand', Brand, 'cars');

    var Boat = storago.define('boats', {type: 'text', size: 'text'});

    var katamaran = new Boat();
    katamaran.id = 12;

    //console.log(car._META.parents);
    var fiat = new Brand();
    fiat.id = 13;

    var vw = new Brand();
    vw.id = 15;

    var palio = new Car();
    palio.brand(fiat);

    //console.log(palio);

    palio.brand(function(brand){ console.log(brand) });
    //console.log(palio._MET);




    //console.log(boat._META);

  });
});
