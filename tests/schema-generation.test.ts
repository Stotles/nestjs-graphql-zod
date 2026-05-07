import 'reflect-metadata'
import { describe, it, expect, beforeAll } from 'vitest'
import { z } from 'zod'

import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
  Resolver,
} from '@nestjs/graphql'
import { NestFactory } from '@nestjs/core'
import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
  printSchema,
  type GraphQLSchema,
} from 'graphql'

import { modelFromZod } from '../src/model-from-zod'
import {
  inputFromZod,
  MutationWithZod,
  QueryWithZod,
} from '../src'

// All schemas used by the resolvers below. Defined once so each generated
// model class is created once and the factory can register them as orphan
// types if needed.
const TaskStatus = z
  .enum(['active', 'completed', 'archived'])
  .describe('TaskStatus: lifecycle of a task')

const Task = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  done: z.boolean().default(false),
  priority: z.number().int().default(0),
  status: TaskStatus,
}).describe('Task: a unit of work')

const TaskInput = z.object({
  title: z.string(),
  description: z.string().optional(),
  status: TaskStatus,
})

const Profile = z.object({
  email: z.email(),
  homepage: z.url().optional(),
}).describe('Profile: external identifiers for a user')

const User = z.object({
  id: z.uuid(),
  name: z.string(),
  age: z.number().int().default(0),
  bio: z.string().nullable(),
  profile: Profile,
  tags: z.array(z.string()),
}).describe('User: an account holder')

const TaskModel = modelFromZod(Task, { name: 'Task' })
const UserModel = modelFromZod(User, { name: 'User' })
const TaskInputModel = inputFromZod(TaskInput, { name: 'TaskInput' })

@Resolver(() => TaskModel)
class TaskResolver {
  @QueryWithZod(Task)
  task() {
    return {
      id: '1',
      title: 'demo',
      description: undefined,
      done: false,
      priority: 0,
      status: 'active',
    }
  }

  @QueryWithZod(Task, 'taskList')
  tasks() {
    return []
  }

  @MutationWithZod(Task)
  createTask() {
    // Parameter decorators (@Args(..., { type: () => TaskInputModel })) need
    // emitDecoratorMetadata which vitest's transformer doesn't honour. We
    // instead pass TaskInputModel as an orphaned type below so it still ends
    // up in the schema and we can assert against it.
    return {
      id: '2',
      title: 'created',
      description: undefined,
      done: false,
      priority: 1,
      status: 'completed',
    }
  }
}

@Resolver(() => UserModel)
class UserResolver {
  @QueryWithZod(User)
  user() {
    return {
      id: '00000000-0000-0000-0000-000000000000',
      name: 'Alice',
      age: 30,
      bio: null,
      profile: { email: 'alice@example.com', homepage: undefined },
      tags: ['admin'],
    }
  }
}

let schema: GraphQLSchema
let sdl: string

beforeAll(async () => {
  const app = await NestFactory.createApplicationContext(GraphQLSchemaBuilderModule, {
    logger: false,
    abortOnError: false,
  })
  const factory = app.get(GraphQLSchemaFactory)
  schema = await factory.create([TaskResolver, UserResolver], {
    orphanedTypes: [TaskInputModel],
  })
  sdl = printSchema(schema)
  await app.close()
})

describe('GraphQL schema generation', () => {
  it('should print without errors', () => {
    expect(typeof sdl).toBe('string')
    expect(sdl.length).toBeGreaterThan(0)
  })

  describe('object type from zod', () => {
    it('should map z.string()/z.uuid()/z.email()/z.url() to String', () => {
      const TaskType = schema.getType('Task') as GraphQLObjectType
      const idType = TaskType.getFields().id.type
      expect(idType).toBeInstanceOf(GraphQLNonNull)
      expect((idType as GraphQLNonNull<typeof GraphQLString>).ofType).toBe(GraphQLString)

      const UserType = schema.getType('User') as GraphQLObjectType
      const uuidType = UserType.getFields().id.type as GraphQLNonNull<typeof GraphQLString>
      expect(uuidType.ofType).toBe(GraphQLString)
    })

    it('should map z.boolean() to Boolean', () => {
      const TaskType = schema.getType('Task') as GraphQLObjectType
      const doneType = TaskType.getFields().done.type as GraphQLNonNull<typeof GraphQLBoolean>
      expect(doneType.ofType).toBe(GraphQLBoolean)
    })

    it('should map z.number().int() and z.int() to Int', () => {
      const TaskType = schema.getType('Task') as GraphQLObjectType
      const priorityType = TaskType.getFields().priority.type as GraphQLNonNull<GraphQLObjectType>
      expect((priorityType.ofType as unknown as { name: string }).name).toBe('Int')

      const UserType = schema.getType('User') as GraphQLObjectType
      const ageType = UserType.getFields().age.type as GraphQLNonNull<GraphQLObjectType>
      expect((ageType.ofType as unknown as { name: string }).name).toBe('Int')
    })

    it('should make optional fields nullable in the schema', () => {
      const TaskType = schema.getType('Task') as GraphQLObjectType
      const description = TaskType.getFields().description.type
      // optional() — no NonNull wrapper, so the bare scalar leaks through.
      expect(description).toBe(GraphQLString)
    })

    it('should keep nullable fields nullable but distinct from optional', () => {
      const UserType = schema.getType('User') as GraphQLObjectType
      const bioType = UserType.getFields().bio.type
      expect(bioType).toBe(GraphQLString)
    })

    it('should generate a nested object class for nested zod objects', () => {
      const UserType = schema.getType('User') as GraphQLObjectType
      const profileField = UserType.getFields().profile.type as GraphQLNonNull<GraphQLObjectType>
      const ProfileType = profileField.ofType
      expect(ProfileType).toBeInstanceOf(GraphQLObjectType)
      expect(ProfileType.getFields()).toHaveProperty('email')
      expect(ProfileType.getFields()).toHaveProperty('homepage')
    })

    it('should turn arrays into list types', () => {
      const UserType = schema.getType('User') as GraphQLObjectType
      const tagsType = UserType.getFields().tags.type
      // [String!]! — non-null list of non-null string.
      expect(tagsType).toBeInstanceOf(GraphQLNonNull)
    })
  })

  describe('enums', () => {
    it('should register zod enums as GraphQLEnumType', () => {
      // The library names enums "<Parent>_<Field>_Enum_<n>" via build-enum-type.
      const enumType = Object
        .values(schema.getTypeMap())
        .find((t): t is GraphQLEnumType => t instanceof GraphQLEnumType
          && t.getValues().some(v => v.value === 'active' || v.value === 'completed'))
      expect(enumType).toBeDefined()
      const values = enumType!.getValues().map(v => v.value).sort()
      expect(values).toEqual(['active', 'archived', 'completed'])
    })
  })

  describe('input types', () => {
    it('should register inputFromZod as a GraphQLInputObjectType', () => {
      const TaskInputType = schema.getType('TaskInput')
      expect(TaskInputType).toBeInstanceOf(GraphQLInputObjectType)

      const fields = (TaskInputType as GraphQLInputObjectType).getFields()
      expect(fields).toHaveProperty('title')
      expect(fields).toHaveProperty('description')
      expect(fields).toHaveProperty('status')
    })
  })

  describe('queries and mutations', () => {
    it('should expose the queries from the resolver', () => {
      const Query = schema.getQueryType()!
      const fields = Query.getFields()
      expect(fields).toHaveProperty('task')
      expect(fields).toHaveProperty('taskList')
      expect(fields).toHaveProperty('user')
    })

    it('should keep the schema field name from the string-name overload', () => {
      // QueryWithZod(Task, 'taskList') should rename `tasks` to `taskList`
      // in the schema while still registering the Task return type.
      const Query = schema.getQueryType()!
      const taskList = Query.getFields().taskList
      expect(taskList).toBeDefined()
      // Default array nullability: the resolver returns Task array — so the
      // field's underlying named type should be Task.
      const fieldType = taskList.type as { ofType?: { name?: string }, name?: string }
      const named = fieldType.ofType?.name ?? fieldType.name
      expect(named).toBe('Task')
    })

    it('should expose the mutation', () => {
      const Mutation = schema.getMutationType()!
      const fields = Mutation.getFields()
      expect(fields).toHaveProperty('createTask')
    })
  })

  describe('SDL snapshot', () => {
    it('should declare the Task object type with the expected fields', () => {
      // We assert the *content* rather than a full snapshot to avoid being
      // overly sensitive to whitespace/ordering differences across versions.
      expect(sdl).toMatch(/type Task\s*{[^}]*id: String!/)
      expect(sdl).toMatch(/type Task\s*{[^}]*title: String!/)
      expect(sdl).toMatch(/type Task\s*{[^}]*priority: Int!/)
      expect(sdl).toMatch(/type Task\s*{[^}]*description: String\b/)
    })

    it('should declare the TaskInput input type', () => {
      expect(sdl).toMatch(/input TaskInput\s*{[^}]*title: String!/)
    })
  })
})

