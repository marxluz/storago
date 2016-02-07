var storago = {};
;(function(storago){

   var Metadata = function(){
     this.dependents = {};
     this.parents = {};
   };

   var Entry = function(name, prop){};
   Entry.prototype.id = null;

   Entry.find = function(id, cb){
     var select = this.select();
     select.where(this._META.name + '.id = ?', id);
     select.limit(1);
   };

   Entry.select = function(){
     var select = new query.Select();
     select.from(this._META.name);
     return select;
   };

   Entry.hasMany = function(name, parent_entry, many_name){
     this._META.parents[name] = parent_entry;
     if(many_name) parent_entry._META.dependents[many_name] = this;

     this.prototype[name] = function(cbORobj){

       var ref_column = name + '_id';

       if(typeof(cbORobj) == 'function'){// get mode

         parent_entry.find(this[ref_column], cbORobj);
         return;

       }else if(typeof(cbORobj) == 'object'){ // set mode

         if(cbORobj._META && cbORobj._META.name == parent_entry._META.name){
           this[ref_column] = cbORobj.id;
           return;

         }else{
           var msg = "(storago) No permission: object must be of class(" + parent_entry._META.name + ")" ;
           msg += ", but is the class(" + cbORobj._META.name + ")";
           throw msg;
         }
       }
     };

   };

   var define = function(name, props){

     var meta = new Metadata();
     meta.name = name;
     meta.props = props;

     var table = function(){};
     for(var i in Entry) table[i] = Entry[i]; //clone Entry

     table._META = meta;
     table.prototype = new Entry();
     table.prototype._META = meta;

     return table;
   };
   storago.define = define;

   var schema = function(callback){

   };
   storago.syncSchema = schema;

   //query
   var query = {};
   storago.query = {};

   var select = function(){
     this._offset = null;
     this._limit = null;
     this._from = null;
     this._wheres = [];
     this._joins = [];
     this._columns = [];
     this._values = [];
   }
   query.Select = select;

   select.prototype.limit = function(limit, offset){
     this._limit = limit;
     if(offset) this._offset = offset;
     return this;
   };

   select.prototype.where = function(where, data){
     this._wheres.push([where, data]);
     return this;
   };

   select.prototype.from = function(from, columns){
     this._from = from;
     if(columns == undefined) columns = ['*'];
     for(var c in columns) this._columns.push(from + '.' + columns[c]);
     return this;
   };

   select.prototype.render = function(){

     var sql = 'SELECT';
     for(var c in this._columns){
       if(c == 0){
         sql += ' ';
       }else{
         sql += ', ';
       }
       sql += this._columns[c];
     }

     if(this._from != null){
        sql += ' FROM ' + this._from;
     };

     if(this._wheres.length){
       sql += ' WHERE ';
       for(var w in this._wheres){
         sql += this._wheres[w][0];
         this._values.push(this._wheres[w][1]);
       }
     }

     if(this._limit != null){
       sql += ' LIMIT ' + this._limit;
     }

     if(this._offset != null){
       sql += ' OFFSET ' + this._offset;
     }

     sql += ';';
     return sql;
   };

   select.prototype.getValues = function(){
     return this._values;
   };

   select.prototype.toString = function(){
     return this.render();
   };

}(storago));
