var storago = {};
;(function(storago){

   var Metadata = function(){
     this.hasMany = {};
     this.parents = {};
   };

   var Entry = function(name, prop){

   };
   Entry.prototype.id = null;

   Entry.hasMany = function(name, parent_entry, many_name){
     this._META.parents[name] = parent_entry;
     if(many_name) parent_entry._META.hasMany[many_name] = this;

     Object.defineProperty(this.prototype, name, {
       get: function(){ return 'hehe' },
       set: function(obj){
         console.log(obj._META.name, parent_entry._META.name);
         if(obj._META.name == parent_entry._META.name){
           this[name + '_id'] = obj.id;
         }else{
           var msg = "(storago) No permission: object must be of class(" + parent_entry._META.name + ")" ;
           msg += ", but is the class(" + obj._META.name + ")";
           throw msg;
         }
       }
     });

     if(many_name){
        Object.defineProperty(parent_entry.prototype, many_name, {
          'get': function(){},
        });
     }
   };

   var define = function(name, props){

     var meta = new Metadata();
     meta.name = name;
     meta.props = props;

     var table = function(){};
     table.hasMany = Entry.hasMany;
     table._META = meta;
     table.prototype = new Entry();
     table.prototype._META = meta;

     return table;
   };
   storago.define = define;

   var schema = function(callback){

   };
   storago.syncSchema = schema;

}(storago));
