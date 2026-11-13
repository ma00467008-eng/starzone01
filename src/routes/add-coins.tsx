const { data: payoutAccount, refetch: refetchPayout } = useQuery({
  queryKey: ["payout-account", session?.user.id],
  enabled: !!session,
  queryFn: async () => (await supabase.from("payout_accounts").select("*").maybeSingle()).data,
});
const [bindMethod, setBindMethod] = useState<"easypaisa" | "jazzcash">("easypaisa");
const [bindName, setBindName] = useState("");
const [bindNumber, setBindNumber] = useState("");
const [bindBusy, setBindBusy] = useState(false);

const handleBind = async () => {
  if (!bindName.trim() || !bindNumber.trim()) {
    toast.error("Please enter account name and number");
    return;
  }
  setBindBusy(true);
  const { error } = await supabase.rpc("bind_payout_account", {
    _method: bindMethod,
    _name: bindName.trim(),
    _number: bindNumber.trim(),
  });
  setBindBusy(false);
  if (error) {
    toast.error(error.message);
    return;
  }
  toast.success("Account bound successfully!");
  refetchPayout();
};
