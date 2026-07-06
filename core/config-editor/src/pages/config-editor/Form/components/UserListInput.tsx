import { useEffect } from "react";
import { InputProps } from "../../../../utils/react";


export function UserListInput(
  { value, onChange }: InputProps<Array<string>>
){
  useEffect(()=>{
    if(value.length === 0){
      onChange([createUser(0)])
      return;
    }
  }, [value])
  return (
    <div>
      <span>Total Users: </span>
      <input
        type="number" min="1" step={1}
        defaultValue={1}
        onBlur={(e)=>{
          const count = Number.parseInt(e.target.value);
          if(Number.isNaN(count)) return;
          if(count === value.length) return;
          if(count < value.length) return onChange(value.slice(0, count))
          const offset = value.length;
          const newLength = count - value.length;
          onChange([
            ...value,
            ...Array.from(
              { length: newLength }, (v, i)=>(createUser(i + offset))
            )
          ])
        }}
      />
    </div>
  )

}

export function ActiveUserInput(
  { value, onChange, userList }: (
    & InputProps<string>
    & { userList: Array<string> }
  )
){
  useEffect(()=>{
    if(userList.includes(value)) return;
    onChange(userList[0])
  }, [value, userList])
  return (
    <div>
      <span>User: </span>
      <select value={value} onChange={(e)=>(onChange(e.target.value))} >
        {userList.map((user)=>(
          <option value={user} >{user}</option>
        ))}
      </select>
    </div>
  )
}

export function createUser(index: number){
  return "User " + index;
}

export function diffUsers(
  oldUsers: Array<string>, newUsers: Array<string>
){
  if(oldUsers.length !== newUsers.length) return -1;
  const oldSet = new Set(oldUsers);
  for(const user of newUsers){
    if(!oldSet.has(user)) return -1
  }
  return 1;
}
