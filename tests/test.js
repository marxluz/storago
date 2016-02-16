describe('DB test', function(){

  it('is exists', function(){
      expect(window.openDatabase).toBeDefined();
      expect(storago).toBeDefined();
  });

  it('teste bobio', function() {
      expect(storago).toBeDefined();

  });

  describe('assincrono', function(){
      console.log('AKI*******************************');
      var Boat = null;
      var Brand =null;
      var Car = null;

      var spy1 = null;

      beforeEach(function (done){
          storago.debug = true;
          Boat = storago.define('boats', {type: 'text', size: 'numeric'});
          Brand = storago.define('brands', {name: 'text'});
          Car = storago.define('cars', {type: 'text', color: 'text'});

          spy1 = jasmine.createSpy('save1');
          spy2 = jasmine.createSpy('save2');

          Brand.hasMany('cars', Car, 'brand');

          storago.connect('shop_car', '1.0', 'Showrow of cars', 5 * 1024 * 1024);
          storago.schema(function(){
              var katamaran = new Boat();
              katamaran.id = 12;

              //console.log(car._META.parents);
              var fiat = new Brand();
              fiat.name = 'Fiat';
              fiat.save(
                  function(){
                      var palio = new Car();
                      palio.type = 'SW';
                      palio.color = 'Black';
                      palio.brand(fiat);
                      palio.save(
                          function(){
                              spy1("fiat")

                              palio.brand(function(b){
                                  spy2(b.name);
                                  done();
                              });
                          }
                      );
                  }
              );



              var vw = new Brand();
              vw.name = 'Volkswagen';
              vw.save();


          });
      });

      it('create table', function(done){
          expect(spy1).toHaveBeenCalledWith('fiat')
          expect(false).not.toBe(true, "Carros não foram salvos");
          expect(spy2).toHaveBeenCalledWith('Fiat')



          done();
      });

  });

});
