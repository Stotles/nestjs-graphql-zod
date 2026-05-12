import 'reflect-metadata'
import { describe, it, expect, vi } from 'vitest'

import { makeDecoratorFromFactory } from '../../src/decorators/make-decorator-from-factory'
import type { TypeOptionInputMethodDecoratorFactory } from '../../src/decorators/types'
import type { SupportedOptionTypes } from '../../src/decorators/zod-options-wrapper.interface'

const stubDecorator: MethodDecorator = () => {}

class StubModel {}

type Factory = TypeOptionInputMethodDecoratorFactory<SupportedOptionTypes>

// Variadic unknown[] gives mock.calls typed as unknown[][], avoiding empty-tuple inference.
function makeFactory(impl?: () => MethodDecorator) {
  return vi.fn<(...args: unknown[]) => MethodDecorator>(impl ?? (() => stubDecorator))
}

describe('makeDecoratorFromFactory', () => {
  describe('string nameOrOptions (the string-name overload fix)', () => {
    it('calls the factory with a typeFunc and { name } options, not as a bare name string', () => {
      const factory = makeFactory()

      makeDecoratorFromFactory('myQuery', factory as unknown as Factory, StubModel as any)

      expect(factory).toHaveBeenCalledOnce()
      const [typeFunc, options] = factory.mock.calls[0]
      expect(typeof typeFunc).toBe('function')
      expect((typeFunc as unknown as () => unknown)()).toBe(StubModel)
      expect(options).toMatchObject({ name: 'myQuery' })
    })

    it('returns the decorator produced by the factory', () => {
      const sentinel: MethodDecorator = () => {}
      const factory = makeFactory(() => sentinel)

      const result = makeDecoratorFromFactory('renamed', factory as unknown as Factory, StubModel as any)

      expect(result).toBe(sentinel)
    })
  })

  describe('object nameOrOptions', () => {
    it('strips the zod key and forwards remaining options with a typeFunc', () => {
      const factory = makeFactory()

      makeDecoratorFromFactory(
        { zod: { name: 'Ignored' }, name: 'explicit', nullable: false } as any,
        factory as unknown as Factory,
        StubModel as any,
      )

      const [typeFunc, options] = factory.mock.calls[0]
      expect(typeof typeFunc).toBe('function')
      expect(options).toMatchObject({ name: 'explicit', nullable: false })
      expect((options as Record<string, unknown>).zod).toBeUndefined()
    })
  })

  describe('undefined nameOrOptions', () => {
    it('calls the factory with only a typeFunc', () => {
      const factory = makeFactory()

      makeDecoratorFromFactory(undefined, factory as unknown as Factory, StubModel as any)

      expect(factory).toHaveBeenCalledOnce()
      const [typeFunc, options] = factory.mock.calls[0]
      expect(typeof typeFunc).toBe('function')
      expect(options).toBeUndefined()
    })
  })
})
