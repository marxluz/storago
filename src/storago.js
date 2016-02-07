var storago = {};
;(function(storago){

  var metadatas = [];

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

   var connect = function(name, version, description, size){
     storago.db = openDatabase(name, version, description, size);
   };
   storago.connect = connect;

   var define = function(name, props){

     var meta = new Metadata();
     meta.name = name;
     meta.props = props;
     metadatas.push(meta);

     var table = function(){};
     for(var i in Entry) table[i] = Entry[i]; //clone Entry

     table._META = meta;
     table.prototype = new Entry();
     table.prototype._META = meta;

     return table;
   };
   storago.define = define;

   var schema = function(callback){

     console.log(storago.db);
     storago.db.transaction(function(tx){
       for(var m in metadatas){
         var meta = metadatas[m];
         var make = new query.Create(meta);
         console.log(make.render());
         tx.executeSql(make.render());
       }
     });
   };
   storago.syncSchema = schema;

   //query
   var query = {};
   storago.query = {};

   //query.Select class
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

   //query.Create class
   var create = function(meta){
     this.meta = meta;
     this.columns = [];
     this.indexs = [];
   };
   query.Create = create;

   create.prototype.parse = function(){

     if(!this.meta.props.hasOwnProperty('id')){
       this.columns.push('id INTEGER PRIMARY KEY AUTOINCREMENT');
     }

     for(var name in this.meta.props){
       var type = this.meta.props[name];
       this.columns.push(name + ' ' + type.toUpperCase());
     }
   };

   create.prototype.render = function(){

     this.parse();
     var sql = 'CREATE TABLE IF NOT EXISTS ' + this.meta.name + '(';
     for(var c in this.columns){
       sql += this.columns[c];
       if((this.columns.length - 1) != c) sql += ', ';
     }
     sql += ');'

     return sql;
   };

}(storago));
