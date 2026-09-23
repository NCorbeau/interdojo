import assert from "node:assert/strict";
import { orderBossFightChoices } from "../src/app/components/boss-fight-choice-order";

const choices = [{ id: "first" }, { id: "second" }, { id: "third" }];
const ids = (items: typeof choices) => items.map((item) => item.id);
const baseline = ids(orderBossFightChoices(choices, "run-123", "stage-a"));

assert.deepEqual(ids(orderBossFightChoices(choices, "run-123", "stage-a")), baseline);
assert.deepEqual(ids(choices), ["first", "second", "third"], "authored choices must not be mutated");
assert.deepEqual([...baseline].sort(), ids(choices), "shuffling must preserve all choice IDs");

const orders = new Set(
  Array.from({ length: 24 }, (_, index) =>
    ids(orderBossFightChoices(choices, `run-${index}`, "stage-a")).join(","),
  ),
);
assert.ok(orders.size > 1, "different runs should be able to show different orders");

const twoChoiceOrders = new Set(
  Array.from({ length: 24 }, (_, index) =>
    ids(orderBossFightChoices(choices.slice(0, 2), `run-${index}`, "stage-a")).join(","),
  ),
);
assert.equal(twoChoiceOrders.size, 2, "two-choice stages should use both positions across runs");

console.log("Boss Fight choice order: deterministic, complete, and varied across runs");
