import FieldInteger from './fields/integer';


export const square = (n: number): number => {

  return n * n;
}

export const fields = {
  'integer': FieldInteger,
}
