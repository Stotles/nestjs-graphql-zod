import { ZodError, ZodType } from 'zod'

import {
  ArgumentMetadata,
  BadRequestException,
  PipeTransform,
  Type,
  ValidationError,
} from '@nestjs/common'

const isIndexable = (v: unknown): v is Record<PropertyKey, unknown> =>
  typeof v === 'object' && v !== null

/**
 * A validation pipe from `zod` validation schema.
 *
 * @template T The type of the `zod` validation schema.
 * @class ZodValidatorPipe
 * @export
 * @implements {PipeTransform}
 */
export class ZodValidatorPipe<T extends ZodType> implements PipeTransform {
  constructor(
    protected readonly input: T,
    protected readonly klass?: Type<any>,
  ) {}

  async transform(value: any, _metadata: ArgumentMetadata): Promise<any> {
    try {
      return await this.input.parseAsync(value)
    } catch (error_) {
      const error = error_ as ZodError

      const message = error.issues.map((issue) => {
        const property = issue.path.length ? String(issue.path[0]) : ''

        const targetValue = issue.path.reduce<unknown>((prev, curr) => {
          if (!isIndexable(prev)) return undefined
          return prev[curr]
        }, value)

        let children: ValidationError[] | undefined
        if (issue.path.length > 1) {
          children = [{ property: String(issue.path[1]) }]

          let curr = children[0]
          for (let i = 2, limit = issue.path.length; i < limit; ++i) {
            curr.children = [(curr = { property: String(issue.path[i]) })]
          }

          curr.value = targetValue
          curr.constraints = {
            [issue.code]: issue.message,
          }
        }

        return {
          property,
          children,
          value: targetValue,
          constraints: {
            [issue.code]: issue.message,
          },
        } as ValidationError
      })

      throw new BadRequestException(message, 'Validation Exception')
    }
  }
}
