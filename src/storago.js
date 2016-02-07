var storago = {};
;(function(storago){

  var metadatas = [];

   var Metadata = function(){
     this.dependents = {};
     this.parents = {};
   };

   var Entry = function(name, prop){};
   Entry.prototype.id = null;

   Entry.prototype.save = function(){
     var insert = new query.Insert(this._META);
     insert.add(this);

     console.log(storago.db);
     storago.db.transaction(function(tx){
       console.log('oi');
       insert.execute(tx);
     });
   };

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

     var transaction = function(index, tx){
       console.log('passa', index, metadatas.length);
       var meta = metadatas.length > index ? metadatas[index] : null;
       if(meta == null) return;
       var sql  = new query.Create(meta).render();
       console.log(sql);
       tx.executeSql(sql, [], function(tran, result){
         console.log('opa');

         transaction(index + 1, tran);
       }, function(msg){

         console.log('erroor');
       });
     };

     storago.db.transaction(function(tx){
       transaction(0, tx);
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
       this.columns.push('id REAL UNIQUE');
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
     sql += '); '

     return sql;
   };

   //query.Insert class
   var insert = function(meta){
     this.meta = meta;
     this.columns = [];
     this.objects = [];
     this.values = [];
   };
   query.Insert = insert;

   insert.prototype.add = function(obj){

     if(!obj._META || obj._META.name != this.meta.name){
       var msg = "(storago) No permission: object must be of class(" + this.meta.name + ")" ;
       msg += ", but is the class(" + obj._META.name + ")";

       throw msg;
     }

     this.objects.push(obj);
   };

   insert.prototype.parse = function(){

     for(var prop in this.meta.props) this.columns.push(prop);
     for(var parent in this.meta.parents) this.columns.push(parent + '_id');

     for(var o in this.objects){
       var obj = this.objects[0];
       for(c in this.columns){
         var column = this.columns[c];
         this.values.push(obj[column]);
       }
     }
   };

   insert.prototype.render = function(){

     this.parse();
     var sql = 'INSERT INTO ' + this.meta.name + ' (';

     for(var c in this.columns){
       sql += this.columns[c];
       if(c < this.columns.length-1) sql += ',';
     }

     sql += ') VALUES (';

     for(var o in this.objects){
       var obj = this.objects[0];
       for(c in this.columns){
         var column = this.columns[c];
         sql += '?';
         if(c < this.columns.length-1) sql += ', ';
       }
       if(o < this.objects.length-1) sql += '), ';
     }

     sql += ');';
     return sql;
   };

   insert.prototype.execute = function(tx){
     console.log('passa');
     console.log(this.render(), this.values);
     //tx.executeSql(this.render(), this.values);
   };

}(storago));
