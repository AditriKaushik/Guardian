"""A tiny end-to-end example of the Guardian monitor method."""

from guardian import Guardian, Member, Group


def fake_locate(member, mode):
    # Pretend this reads a real GPS/phone API.
    return {"lat": 40.71, "lon": -74.00, "label": f"{member.name}'s phone"}


def main():
    # Set up family members and what each has agreed to.
    kid = Member("kid1", "Sam", role="child").grant("locate", "view")
    mom = Member("p1", "Maria", role="parent").grant("locate")
    dad = Member("p2", "David", role="parent")  # consented to nothing

    family = Group("family", "The Rossis").add(kid, mom, dad)

    g = Guardian().register("locate", fake_locate)

    # Locate one child.
    print("One child:", g.monitor(kid, mode="locate"))

    # Locate the whole family in a single call.
    print("\nWhole family:")
    for r in g.monitor(family, mode="locate"):
        status = r.data if r.ok else f"SKIPPED ({r.error})"
        print(f"  {r.member_id}: {status}")


if __name__ == "__main__":
    main()
