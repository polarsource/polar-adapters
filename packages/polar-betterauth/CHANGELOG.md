# @polar-sh/hono

## 0.1.0

### Minor Changes

- 70362f0: ## Breaking changes

  Checkout endpoints no longer support `productId` and `productPriceId` parameter to pass the product. Use `products` instead.

  ## Added

  Checkout endpoints now support the `products` parameter. You can repeat it to pass several products to the Checkout session.

## 0.0.11

### Patch Changes

- fc6c8a6: Throw API error when customer creation fails

## 0.0.10

### Patch Changes

- f2433b0: fix webhooks imports

## 0.0.9

### Patch Changes

- ff2ce69: Add new order webhook support

## 0.0.8

### Patch Changes

- e5bb5e9: Fix checkout route

## 0.0.7

### Patch Changes

- 32f64b5: graceful customer creation

## 0.0.6

### Patch Changes

- c9daadf: Bump SDK version

## 0.0.5

### Patch Changes

- e49adbe: Add polar sdk as peer dep

## 0.0.4

### Patch Changes

- 0f1ca22: Add customer state support

## 0.0.3

### Patch Changes

- e806c01: Add support for Customer State

## 0.0.2

### Patch Changes

- 4407e6c: Init Better Auth plugin

## 0.2.18

### Patch Changes

- Updated dependencies [be7db19]
  - @polar-sh/adapter-utils@0.1.12

## 0.2.17

### Patch Changes

- Updated dependencies [f798821]
  - @polar-sh/adapter-utils@0.1.11

## 0.2.16

### Patch Changes

- Updated dependencies [7922261]
- Updated dependencies [e7a7352]
  - @polar-sh/adapter-utils@0.1.10

## 0.2.15

### Patch Changes

- 845f91d: Upgrade SDK usage
- Updated dependencies [845f91d]
  - @polar-sh/adapter-utils@0.1.9

## 0.2.14

### Patch Changes

- 9dd847d: Bump Polar SDK
- Updated dependencies [9dd847d]
  - @polar-sh/adapter-utils@0.1.8

## 0.2.13

### Patch Changes

- 1d6d075: decode the URI properly
- Updated dependencies [1d6d075]
  - @polar-sh/adapter-utils@0.1.7

## 0.2.12

### Patch Changes

- b002bc1: export types
- Updated dependencies [b002bc1]
  - @polar-sh/adapter-utils@0.1.6

## 0.2.11

### Patch Changes

- 350a4e8: Export entitlement utils
- Updated dependencies [350a4e8]
  - @polar-sh/adapter-utils@0.1.5

## 0.2.10

### Patch Changes

- 2ec8d0d: implement entitlements
- Updated dependencies [2ec8d0d]
  - @polar-sh/adapter-utils@0.1.4

## 0.2.9

### Patch Changes

- f732797: Exports Entitlement class
- Updated dependencies [f732797]
  - @polar-sh/adapter-utils@0.1.3

## 0.2.8

### Patch Changes

- 4038228: make sure to pass either price or product in checkout
- Updated dependencies [4038228]
  - @polar-sh/adapter-utils@0.1.2

## 0.2.7

### Patch Changes

- 2746035: Add productPriceId param capability

## 0.2.6

### Patch Changes

- aa6b311: init adapter-utils
- abd0e90: fix utils
- aa6b311: resolve core from workspace
- Updated dependencies [aa6b311]
- Updated dependencies [abd0e90]
- Updated dependencies [aa6b311]
  - @polar-sh/adapter-utils@0.1.1

## 0.2.5

### Patch Changes

- 234ba51: resolve core from workspace
- Updated dependencies [49d21c1]
- Updated dependencies [234ba51]
  - @polar-sh/adapter-core@0.1.5

## 0.2.4

### Patch Changes

- 98a1bf9: add core dependency
- Updated dependencies [98a1bf9]
  - @polar-sh/adapter-utils@0.1.3

## 0.2.3

### Patch Changes

- Updated dependencies [4abbedc]
  - @polar-sh/adapter-utils@0.1.2

## 0.2.2

### Patch Changes

- 46ad781: Await webhook handlers
- Updated dependencies [46ad781]
  - @polar-sh/adapter-utils@0.1.1

## 0.2.1

### Patch Changes

- dda069d: Add granular webhook handlers

## 0.2.0

### Minor Changes

- eb28d55: Add CommonJS module and Sourcemaps

## 0.1.4

### Patch Changes

- fd20c5a: fix biome

## 0.1.3

### Patch Changes

- 698e06c: fix webhooks
- 698e06c: fix types

## 0.1.2

### Patch Changes

- 8996fa7: add tsup

## 0.1.1

### Patch Changes

- e4fc754: init
