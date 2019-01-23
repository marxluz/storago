const assert = require('assert');

describe('Array', function(){

  it('should return -1', function(done){
  
    setTimeout(function(){
    
      assert.equal([1,2,3].indexOf(4), -1);
      done();
    }, 1500);
  });
});
