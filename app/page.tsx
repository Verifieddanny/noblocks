"use client";
import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";

import { FormData, InstitutionProps, StateProps } from "./types";
import {
  fetchSupportedInstitutions,
  fetchRate,
  fetchAccountName,
} from "./api/aggregator";
import {
  AnimatedPage,
  Preloader,
  TransactionForm,
  TransactionPreview,
} from "./components";
import { useReadContract } from "wagmi";
import { gatewayAbi } from "./api/abi";
import TransactionStatus from "./pages/TransactionStatus";

const GATEWAY_CONTRACT_ADDRESS = "0x847dfdAa218F9137229CF8424378871A1DA8f625";

const INITIAL_FORM_STATE: FormData = {
  network: "",
  token: "",
  amount: 0,
  currency: "",
  institution: "",
  accountIdentifier: "",
  recipientName: "",
  memo: "",
};

/**
 * Represents the Home component.
 * This component handles the logic and rendering of the home page.
 */
export default function Home() {
  // State variables
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isFetchingInstitutions, setIsFetchingInstitutions] = useState(false);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [isFetchingRecipientName, setIsFetchingRecipientName] = useState(false);

  const [protocolFeePercent, setProtocolFeePercent] = useState<number>(0);
  const [fee, setFee] = useState<number>(0);
  const [rate, setRate] = useState<number>(0);
  const [recipientName, setRecipientName] = useState<string>("");
  const [formValues, setFormValues] = useState<FormData>(INITIAL_FORM_STATE);
  const [institutions, setInstitutions] = useState<InstitutionProps[]>([]);

  const [selectedNetwork, setSelectedNetwork] = useState<string>("base");
  const [selectedTab, setSelectedTab] = useState<string>("bank-transfer");

  // Form methods and watch
  const formMethods = useForm<FormData>({ mode: "onChange" });
  const { watch } = formMethods;
  const { currency, amount, token, accountIdentifier, institution } = watch();

  // Custom hooks for account and contract interactions
  const { data: protocolFeeDetails } = useReadContract({
    abi: gatewayAbi,
    address: GATEWAY_CONTRACT_ADDRESS,
    functionName: "getFeeDetails",
  });

  // Transaction status and error handling
  const [transactionStatus, setTransactionStatus] = useState<
    | "idle"
    | "pending"
    | "processing"
    | "fulfilled"
    | "validated"
    | "settled"
    | "refunded"
  >("idle");
  const [createdAt, setCreatedAt] = useState<string>("");
  const [orderId, setOrderId] = useState<string>("");

  /**
   * Handles form submission.
   * @param data - The form data.
   */
  const onSubmit = (data: FormData) => {
    setFormValues(data);
  };

  /**
   * Handles network change.
   * @param network - The selected network.
   */
  const handleNetworkChange = (network: string) => {
    setSelectedNetwork(network);
  };

  /**
   * Handles tab change.
   * @param tab - The selected tab.
   */
  const handleTabChange = (tab: string) => {
    setSelectedTab(tab);
  };

  // State props for child components
  const stateProps: StateProps = {
    formValues,
    fee,
    rate,
    isFetchingRate,
    recipientName,
    isFetchingRecipientName,
    institutions,
    isFetchingInstitutions,
    selectedTab,
    handleTabChange,
    selectedNetwork,
    setCreatedAt,
    setOrderId,
    handleNetworkChange,
    setTransactionStatus,
  };

  // Fetch supported institutions based on currency
  useEffect(() => {
    const getInstitutions = async () => {
      if (!currency) return;

      setIsFetchingInstitutions(true);

      try {
        const institutions = await fetchSupportedInstitutions(currency);
        setInstitutions(institutions);
        setIsFetchingInstitutions(false);
      } catch (error) {
        console.log(error);
      }
    };

    getInstitutions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency]);

  // Fetch recipient name based on institution and account identifier
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const getRecipientName = async () => {
      if (!accountIdentifier || !institution) return;

      setIsFetchingRecipientName(true);

      try {
        const accountName = await fetchAccountName({
          institution,
          accountIdentifier,
        });
        setRecipientName(accountName);
        setIsFetchingRecipientName(false);
      } catch (error) {
        setRecipientName("");
        setIsFetchingRecipientName(false);
      }
    };

    const debounceFetchRecipientName = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(getRecipientName, 1000);
    };

    debounceFetchRecipientName();

    return () => {
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountIdentifier]);

  // Fetch rate based on currency, amount, and token
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const getRate = async () => {
      if (!currency || !amount || !token) return;
      setIsFetchingRate(true);
      try {
        const rate = await fetchRate({
          token: "USDT",
          amount: amount,
          currency: currency,
        });
        setRate(rate.data);
        setIsFetchingRate(false);
      } catch (error) {
        console.log(error);
      }
    };

    const debounceFetchRate = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(getRate, 1000);
    };

    debounceFetchRate();

    return () => {
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, amount, token]);

  // Calculate fee based on protocol fee details and amount
  useEffect(() => {
    setProtocolFeePercent(
      Number(protocolFeeDetails?.[0]!) / Number(protocolFeeDetails?.[1]!),
    );

    setFee(
      parseFloat(
        Number(protocolFeePercent * Number(amount))
          .toFixed(5)
          .toString(),
      ),
    );
  }, [protocolFeeDetails, amount, protocolFeePercent]);

  // Set page loading state to false after initial render
  useEffect(() => {
    setIsPageLoading(false);
  }, []);

  return (
    <>
      <Preloader isLoading={isPageLoading} />

      <AnimatePresence mode="wait">
        {transactionStatus !== "idle" ? (
          <AnimatedPage key="transaction-status">
            <TransactionStatus
              formMethods={formMethods}
              transactionStatus={transactionStatus}
              createdAt={createdAt}
              orderId={orderId}
              recipientName={stateProps.recipientName}
              clearForm={() => setFormValues(INITIAL_FORM_STATE)}
              clearTransactionStatus={() => {
                setTransactionStatus("idle");
              }}
              setTransactionStatus={setTransactionStatus}
            />
          </AnimatedPage>
        ) : (
          <>
            {Object.values(formValues).every(
              (value) => value === "" || value === 0,
            ) ? (
              <AnimatedPage key="transaction-form">
                <TransactionForm
                  onSubmit={onSubmit}
                  formMethods={formMethods}
                  stateProps={stateProps}
                />
              </AnimatedPage>
            ) : (
              <AnimatedPage key="transaction-preview">
                <TransactionPreview
                  handleBackButtonClick={() =>
                    setFormValues(INITIAL_FORM_STATE)
                  }
                  stateProps={stateProps}
                />
              </AnimatedPage>
            )}
          </>
        )}
      </AnimatePresence>
    </>
  );
}
