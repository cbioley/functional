import { factorizeType } from "./SumType.js";
import Either from "./Either.js";

const $$debug = Symbol.for("TaskDebug");

export const Task = factorizeType("Task", [ "asyncFunction" ]);

const serializeFunctionForDebug = asyncFunction =>
  (asyncFunction.name && asyncFunction.name !== "")
    ? asyncFunction.name
    : asyncFunction.toString().length > 25
      ? asyncFunction.toString()
        .slice(0, 25)
        .replace(/[\n\r]/g, "")
        .replace(/\s\s*/g, " ") + "[...]"
      : asyncFunction.toString()
        .replace(/[\n\r]/g, "")
        .replace(/\s\s*/g, " ")

Task.from = (composedFunction) => Task(composedFunction);

Task.wrap = asyncFunction => {
  let promise;
  const proxyFunction = function (...argumentList) {
    promise = promise || asyncFunction.call(null, ...argumentList);

    return promise.then(
      maybeContainer => Either.is(maybeContainer) ? maybeContainer : Either.Right(maybeContainer),
      maybeContainer => Either.is(maybeContainer) ? maybeContainer : Either.Left(maybeContainer)
    );
  };

  return Object.defineProperty(
    Task(
      Object.defineProperty(
        proxyFunction,
        'length',
        { value: asyncFunction.length }
      )
    ),
    $$debug,
    {
      writable: false,
      value: `Task(${serializeFunctionForDebug(asyncFunction)})`
    }
  );
};

Task.empty = Task.prototype.empty = Task.prototype["fantasy-land/empty"] = _ => Task(_ => function () {});

Task.of = Task.prototype.of = Task.prototype["fantasy-land/of"] = value =>
  Object.defineProperty(
    Task(_ => Promise.resolve(Either.Right(value))),
    $$debug,
    {
      writable: false,
      value: `Task(${serializeFunctionForDebug(value)})`
    }
  );

Task.prototype.ap = Task.prototype["fantasy-land/ap"] = function (container) {

  return Object.defineProperty(
    Task(_ => {
      const maybePromiseUnaryFunction = this.asyncFunction();
      const maybePromiseValue = container.asyncFunction();

      return Promise.all([
        (maybePromiseUnaryFunction instanceof Promise)
          ? maybePromiseUnaryFunction
          : Promise.resolve(maybePromiseUnaryFunction),
        (maybePromiseValue instanceof Promise)
          ? maybePromiseValue
          : Promise.resolve(maybePromiseValue)
      ])
        .then(([ maybeApplicativeUnaryFunction, maybeContainerValue ]) => {

          return (
            (Reflect.getPrototypeOf(maybeApplicativeUnaryFunction).ap)
              ? maybeApplicativeUnaryFunction
              : Either.Right(maybeApplicativeUnaryFunction)
          ).ap(
            (Reflect.getPrototypeOf(maybeContainerValue).ap)
              ? maybeContainerValue
              : Either.Right(maybeContainerValue)
          );
        });
    }),
    $$debug,
    {
      writable: false,
      value: `${this[$$debug]}.ap(${container})`
    }
  );
};

Task.prototype.chain = Task.prototype["fantasy-land/chain"] = function (unaryFunction) {

  return Object.defineProperty(
    Task(_ => {
      const maybePromise = this.asyncFunction();

      return (
        (maybePromise instanceof Promise) ? maybePromise : Promise.resolve(maybePromise)
      )
        .then(maybeContainer =>
          (Either.is(maybeContainer) ? maybeContainer : Either.Right(maybeContainer))
            .chain(
              value => {
                const maybePromise = unaryFunction(value).run();

                return (
                  (maybePromise instanceof Promise) ? maybePromise : Promise.resolve(maybePromise)
                )
                  .then(
                    maybeContainer => Either.is(maybeContainer) ? maybeContainer : Either.Right(maybeContainer),
                    maybeContainer => Either.is(maybeContainer) ? maybeContainer : Either.Left(maybeContainer),
                  )
              })
        )
        .catch(Either.Left);
    }),
    $$debug,
    {
      writable: false,
      value: `${this[$$debug]}.chain(${serializeFunctionForDebug(unaryFunction)})`
    }
  );
};

Task.prototype.map = Task.prototype["fantasy-land/map"] = function (unaryFunction) {

  return Object.defineProperty(
    Task(_ => {
      const promise = this.asyncFunction();

      return promise.then(
        container => container.chain(
          value => {
            const maybeContainer = unaryFunction(value);

            return (Either.is(maybeContainer)) ? maybeContainer : Either.Right(maybeContainer);
          }
        ),
        Either.Left
      );
    }),
    $$debug,
    {
      writable: false,
      value: `${this[$$debug]}.map(${serializeFunctionForDebug(unaryFunction)})`
    }
  );
};

Task.prototype.then = function (unaryFunction) {

  return Task(_ => {
    const promise = this.asyncFunction();

    return (promise instanceof Promise)
      ? promise.then(
        container => Either.Right(container.fold({
          Right: unaryFunction,
          Left: _ => container
        })),
        Either.Left.of
      )
      : unaryFunction(promise);
  });
};

Task.prototype.catch = function (unaryFunction) {

  return Task(_ => {
    const value = this.asyncFunction();

    return (value instanceof Promise)
      ? value.then(
        Either.Right.of,
        container => (
          Either.Left.is(container) ? container : Either.Left(container)
        ).fold({
          Right: _ => container,
          Left: unaryFunction
        }),

      )
      : unaryFunction(value);
  });
};

// run :: Task a ~> () -> Promise b
Task.prototype.run = async function () {
  const maybePromise = this.asyncFunction();

  return ((maybePromise instanceof Promise) ? maybePromise : Promise.resolve(maybePromise))
    .then(
      maybeContainer => Either.is(maybeContainer) ? maybeContainer : Either.Right(maybeContainer),
      maybeContainer => Either.is(maybeContainer) ? maybeContainer : Either.Left(maybeContainer)
    );
};

Task.prototype.toString = Task.prototype[Deno.customInspect] = function () {

  return this[$$debug] || `Task("unknown")`
};

export default Task;