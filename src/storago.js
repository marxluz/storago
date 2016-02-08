var storago = {};
;(function(storago){

   //static property
   storago.debug = false;

   //local property
   var metadatas = [];

   //local function
   var Metadata = function(){
     this.dependents = {};
     this.parents = {};
   };

   //class Entry
   var Entry = function(name, prop){};
   Entry.prototype.rowid = null;

   Entry.prototype.save = function(cb){

      var self = this;

      if(this.rowid == null){
         var insert = new query.Insert(this._META);
         insert.add(this);

         storago.db.transaction(function(tx){
            insert.execute(tx, function(tx, result){
               self.rowid = result.insertId;
               if(cb) cb(self);

            },function(tx, err){
               var msg = "(storago) " + err;
               throw msg;
            });
         });

      }else{

         var ondata = function(row){
            var data = row._DATA;
            var update = new query.Update(self._META);

            for(var p in data){
               if(self[p] != data[p]){
                  update.set(p, self[p]);
               }
            }
            update.where('rowid = ?', row.rowid);

            storago.db.transaction(function(tx){
               update.execute(tx, cb, function(tx, err){
                  var msg = "(storago) " + err;
                  throw msg;
               });
            });
         };

         if(!this._DATA){
            this._TABLE.find(this.rowid, ondata);
         }else{
            ondata(this);
         }
      }
   };

   Entry.find = function(id, cb, cbErr){
      var self = this;
      var select = this.select();
      select.where(this._META.name + '.rowid = ?', id);
      select.limit(1);
      storago.db.transaction(function(tx){
         select.execute(tx, function(tx, result){

            if(result.rows.length){
               var row  = result.rows.item(0);
               var entry = new self();
               entry._DATA = row;
               for(var p in row) entry[p] = row[p];
               cb(entry);
            }

        }, function(tx, msg){
           console.log('error', msg);
        });
     });
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
           this[ref_column] = cbORobj.rowid;
           return;

         }else{
           var msg = "(storago) No permission: object must be of class(" + parent_entry._META.name + ")" ;
           msg += ", but is the class(" + cbORobj._META.name + ")";
           throw msg;
         }
       }
     };
   };

   //static function connect
   storago.connect = function(name, version, description, size){
     storago.db = openDatabase(name, version, description, size);
   };

   //static function define
   storago.define = function(name, props){

     var meta = new Metadata();
     meta.name = name;
     meta.props = props;
     metadatas.push(meta);

     var row = function(){};
     for(var i in Entry) row[i] = Entry[i]; //clone Entry

     row._META = meta;
     row.prototype = new Entry();
     row.prototype._TABLE = row;
     row.prototype._META = meta;

     return row;
   };

   //static function schema
   storago.schema = function(cb){

     storago.db.transaction(function(tx){

        for(var m in metadatas){
           var meta = metadatas[m];
           var create = new query.Create(meta);
           create.execute(tx);
        }
     });
   };

   //static function reset
   storago.reset = function(){

      storago.db.transaction(function(tx){
         for(var m in metadatas){
            var meta = metadatas[m];
            var drop = new query.Drop(meta);
            drop.execute(tx);
         }
      });
   };

   //package query
   var query = {};
   storago.query = query;

   //class query.Select
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
     this._columns.push(from + '.rowid');
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

     if(this._from != null) sql += ' FROM ' + this._from;

     if(this._wheres.length){
       sql += ' WHERE ';
       for(var w in this._wheres){
         sql += this._wheres[w][0];
         this._values.push(this._wheres[w][1]);
       }
     }

     if(this._limit != null)  sql += ' LIMIT ' + this._limit;
     if(this._offset != null) sql += ' OFFSET ' + this._offset;
     sql += ';';

     return sql;
   };

   select.prototype.getValues = function(){
     return this._values;
   };

   select.prototype.toString = function(){
     return this.render();
   };

   select.prototype.execute = function(tx, cb, cbErr){
      var sql = this.render();
      if(storago.debug) console.log(sql, this._values);
      tx.executeSql(sql, this._values, cb, cbErr);
   };

   //class query.Create
   var create = function(meta){
     this.meta = meta;
     this.columns = [];
     this.indexs = [];
   };
   query.Create = create;

   create.prototype.parse = function(){

     for(var name in this.meta.props){
       var type = this.meta.props[name];
       this.columns.push(name + ' ' + type.toUpperCase());
     }

     for(var name in this.meta.parents){
        this.columns.push(name + '_id NUMERIC');
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

   create.prototype.execute = function(tx, cb, cbErr){
      var sql = this.render();
      if(storago.debug) console.log(sql);
      tx.executeSql(sql, [], cb, cbErr);
   };

   //class query.Insert
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

     sql += ')';
     return sql;
   };

   insert.prototype.execute = function(tx, cb, cbErr){
      var sql = this.render();
      if(storago.debug) console.log(sql, this.values);
      tx.executeSql(sql, this.values, cb, cbErr);
   };

   //class query.Update
   var update = function(meta){
      this.meta = meta;
      this.wheres = [];
      this.columns = [];
      this.values = [];
   };
   query.Update = update;

   update.prototype.set = function(column, value){
      this.columns.push(column);
      this.values.push(value);
   };

   update.prototype.render = function(){

      if(this.columns.length == 0) return null;

      var sql = 'UPDATE ' + this.meta.name + ' ';

      for(var c in this.columns){
         sql += 'SET ' + this.columns[c] + ' = ?';
         if((this.columns.length - 1) != c) sql += ', ';
      }

      if(this.wheres.length){
         sql += ' WHERE ';
         for(var w in this.wheres){
            var where = this.wheres[w];
            this.values.push(where[1]);
            sql += where[0];
            if((this.wheres.length - 1) != w) sql += ' AND ';
         }
      }

      return sql;
   };

   update.prototype.where = function(where, value){
      this.wheres.push([where, value]);
   };

   update.prototype.execute = function(tx, cb, cbErr){
      var sql = this.render();
      if(sql == null) return;
      if(storago.debug) console.log(sql, this.values);
      tx.executeSql(sql, this.values, cb, cbErr);
   };

   //class query.Drop
   var drop = function(meta){
      this.meta = meta;
   };
   query.Drop = drop;

   drop.prototype.execute = function(tx, cb, cbErr){
      var sql = 'DROP TABLE ' + this.meta.name;
      if(storago.debug) console.log(sql);
      tx.executeSql(sql, cb, cbErr);
   };

}(storago));
