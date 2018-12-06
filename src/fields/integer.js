import BaseField from './base';

export class IntegerField extends BaseField{

  static cast: string = "INTEGER";
  name: string;

  constructor(name: string){
    super();
    this.name = name;
  }

  getCast(){
  
    return 'INT';
  }
}

export default (name: string): IntegerField => {

  let instance = new IntegerField(name);
  return instance;
};
