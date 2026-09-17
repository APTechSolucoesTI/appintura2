import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'

import { Input } from '@/components/ui/input'

interface InputMascaradoProps<T extends FieldValues>
  extends Omit<
    React.ComponentProps<'input'>,
    'name' | 'value' | 'onChange' | 'defaultValue'
  > {
  control: Control<T>
  name: Path<T>
  /** Máscara progressiva aplicada a cada tecla (ver `lib/documento.ts`). */
  mascara: (valor: string) => string
}

/**
 * Input com máscara aplicada durante a digitação. O valor guardado no formulário
 * é o texto mascarado; cada formulário desmascara antes de persistir.
 */
export function InputMascarado<T extends FieldValues>({
  control,
  name,
  mascara,
  ...rest
}: InputMascaradoProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Input
          {...rest}
          value={typeof field.value === 'string' ? field.value : ''}
          onChange={(event) => field.onChange(mascara(event.target.value))}
          onBlur={field.onBlur}
          ref={field.ref}
        />
      )}
    />
  )
}
